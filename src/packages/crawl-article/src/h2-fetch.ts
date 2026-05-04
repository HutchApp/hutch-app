import assert from "node:assert";
import http2 from "node:http2";
import { fetchCurl } from "./curl-fetch";

const MAX_REDIRECTS = 5;
const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);

type FetchH2Init = {
	headers?: Record<string, string>;
	signal?: AbortSignal;
};

type H2RequestResult = {
	status: number;
	headers: http2.IncomingHttpHeaders;
	body: Buffer;
};

/**
 * HTTP/2 fetch with redirect following. Cloudflare's managed challenge
 * blocks HTTP/1.1 clients (Node.js undici/fetch) via TLS fingerprinting.
 * Node's built-in http2 module bypasses the challenge because real browsers
 * negotiate h2 by default and Cloudflare's heuristics trust the handshake.
 */
export async function fetchH2(url: string, init?: FetchH2Init): Promise<Response> {
	let currentUrl = url;
	for (let i = 0; i <= MAX_REDIRECTS; i++) {
		const parsed = new URL(currentUrl);
		const client = http2.connect(parsed.origin);
		try {
			const result = await h2Request(client, parsed, init);
			if (REDIRECT_STATUS_CODES.has(result.status)) {
				const location = result.headers.location;
				assert(typeof location === "string" && location.length > 0, `HTTP/2 ${result.status} from ${currentUrl} missing location header`);
				currentUrl = new URL(location, parsed.origin).href;
				continue;
			}
			return new Response(result.body, {
				status: result.status,
				headers: toFetchHeaders(result.headers),
			});
		} finally {
			client.close();
		}
	}
	throw new Error(`fetchH2: too many redirects for ${url}`);
}

function h2Request(
	client: http2.ClientHttp2Session,
	url: URL,
	init: FetchH2Init | undefined,
): Promise<H2RequestResult> {
	return new Promise((resolve, reject) => {
		client.on("error", reject);
		const reqHeaders: http2.OutgoingHttpHeaders = {
			":method": "GET",
			":path": url.pathname + url.search,
		};
		if (init?.headers) {
			for (const [key, value] of Object.entries(init.headers)) {
				reqHeaders[key] = value;
			}
		}
		const req = client.request(reqHeaders);
		req.on("error", reject);
		const signal = init?.signal;
		if (signal) {
			if (signal.aborted) {
				req.close();
				reject(signal.reason);
				return;
			}
			const onAbort = () => {
				req.close();
				reject(signal.reason);
			};
			signal.addEventListener("abort", onAbort, { once: true });
			req.on("close", () => signal.removeEventListener("abort", onAbort));
		}
		let status: number | undefined;
		let responseHeaders: http2.IncomingHttpHeaders | undefined;
		req.on("response", (headers) => {
			status = Number(headers[":status"]);
			responseHeaders = headers;
		});
		const chunks: Buffer[] = [];
		req.on("data", (chunk: Buffer) => chunks.push(chunk));
		req.on("end", () => {
			assert(status !== undefined, "HTTP/2 stream ended without :status");
			assert(responseHeaders, "HTTP/2 stream ended without response headers");
			resolve({ status, headers: responseHeaders, body: Buffer.concat(chunks) });
		});
		req.end();
	});
}

function toFetchHeaders(incoming: http2.IncomingHttpHeaders): Headers {
	const out = new Headers();
	for (const [key, value] of Object.entries(incoming)) {
		if (key.startsWith(":")) continue;
		if (typeof value !== "string") continue;
		out.set(key, value);
	}
	return out;
}

/**
 * Wraps a fetch with an HTTP/2 fallback that kicks in on any Cloudflare 403
 * (`server: cloudflare`). Covers both managed challenges (`cf-mitigated:
 * challenge`) and plain "Attention Required!" interstitials (no cf-mitigated
 * header), since both are TLS-fingerprint blocks that real browsers bypass
 * via h2. Non-Cloudflare 403s and non-403 responses pass through unchanged.
 *
 * If the h2 fallback itself fails with a TLS- or protocol-level error (e.g.
 * Cloudflare refuses to negotiate h2 via ALPN downgrade), a curl subprocess
 * fallback kicks in. curl's OpenSSL-based TLS fingerprint differs from
 * Node.js's and passes Cloudflare's JA3/JA4 heuristics. Clear network
 * failures (DNS, connection refused) and aborts skip curl since they would
 * fail the same way and only add latency.
 *
 * The primary fetch also falls back to curl on connection-level errors
 * (ECONNRESET, socket hangup) because curl's different TLS stack (OpenSSL
 * vs undici) may succeed where Node's fetch was rejected.
 */
export function withH2Fallback(
	baseFetch: typeof fetch,
	h2FetchImpl: typeof fetchH2 = fetchH2,
	curlFetchImpl: typeof fetchCurl = fetchCurl,
): typeof fetch {
	return async (input, init) => {
		let response: Response;
		try {
			response = await baseFetch(input, init);
		} catch (error) {
			const signal = init?.signal ?? undefined;
			if (signal?.aborted && isTimeoutError(signal.reason)) {
				const url = urlFromInput(input);
				return curlFetchImpl(url, { headers: toPlainHeaders(init?.headers) });
			}
			if (isConnectionResetError(error) && !signal?.aborted) {
				const url = urlFromInput(input);
				return curlFetchImpl(url, { headers: toPlainHeaders(init?.headers), signal });
			}
			throw error;
		}
		if (response.status !== 403) return response;
		if (response.headers.get("server")?.toLowerCase() !== "cloudflare") return response;
		await response.text();
		const url = urlFromInput(input);
		const fallbackInit = {
			headers: toPlainHeaders(init?.headers),
			signal: init?.signal ?? undefined,
		};
		try {
			return await h2FetchImpl(url, fallbackInit);
		} catch (error) {
			if (!shouldFallbackToCurl(error, fallbackInit.signal)) throw error;
			return curlFetchImpl(url, fallbackInit);
		}
	};
}

function isTimeoutError(reason: unknown): boolean {
	return reason instanceof Error && reason.name === "TimeoutError";
}

/**
 * Connection-level errors where curl's OpenSSL TLS stack may succeed where
 * Node's undici was rejected (e.g. server resets after TLS fingerprint
 * inspection). Generic errors without a code are excluded — only known
 * connection error codes trigger the fallback.
 */
const CONNECTION_RESET_CODES = new Set([
	"ECONNRESET",
	"EPIPE",
	"UND_ERR_CONNECT_TIMEOUT",
	"UND_ERR_SOCKET",
]);

function isConnectionResetError(error: unknown): boolean {
	if (!(error instanceof Error)) return false;
	if (!("code" in error) || typeof error.code !== "string") return false;
	return CONNECTION_RESET_CODES.has(error.code);
}

const NETWORK_ERROR_CODES = new Set([
	"ENOTFOUND",
	"ECONNREFUSED",
	"EHOSTUNREACH",
	"ENETUNREACH",
]);

function shouldFallbackToCurl(error: unknown, signal: AbortSignal | undefined): boolean {
	if (signal?.aborted) return false;
	if (!(error instanceof Error)) return true;
	if ("code" in error && typeof error.code === "string" && NETWORK_ERROR_CODES.has(error.code)) {
		return false;
	}
	return true;
}

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

function urlFromInput(input: FetchInput): string {
	if (typeof input === "string") return input;
	if (input instanceof URL) return input.href;
	return input.url;
}

function toPlainHeaders(headers: NonNullable<FetchInit>["headers"]): Record<string, string> | undefined {
	if (!headers) return undefined;
	const out: Record<string, string> = {};
	new Headers(headers).forEach((value, key) => {
		out[key] = value;
	});
	return out;
}
