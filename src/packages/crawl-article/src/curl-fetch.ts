import { execFile as nodeExecFile } from "node:child_process";

const MAX_REDIRECTS = 5;
const DEFAULT_TIMEOUT_MS = 10000;
const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

type CurlFetchInit = {
	headers?: Record<string, string>;
	signal?: AbortSignal;
};

type CurlChild = {
	kill: () => boolean;
	on: (event: string, listener: () => void) => void;
};

type ExecFileFn = (
	file: string,
	args: readonly string[],
	options: { encoding: "buffer"; maxBuffer: number; timeout: number | undefined },
	callback: (error: Error | null, stdout: Buffer) => void,
) => CurlChild;

type FetchCurl = (url: string, init?: CurlFetchInit) => Promise<Response>;

/**
 * Creates a fetchCurl function with an injected execFile dependency.
 * curl's TLS fingerprint (OpenSSL-based) differs from Node.js's
 * (BoringSSL/undici), so Cloudflare's JA3/JA4 heuristics treat it as a
 * trusted client. Used as a last-resort fallback when both Node's fetch
 * and the HTTP/2 module are blocked by TLS fingerprinting.
 */
export function initFetchCurl(deps: { execFile: ExecFileFn }): FetchCurl {
	return (url, init) => {
		return new Promise((resolve, reject) => {
			const args = buildCurlArgs({ url, headers: init?.headers });
			const timeout = init?.signal ? undefined : DEFAULT_TIMEOUT_MS;
			const child = deps.execFile("curl", args, { encoding: "buffer", maxBuffer: 50 * 1024 * 1024, timeout }, (error, stdout) => {
				if (error) {
					reject(new Error(`fetchCurl failed for ${url}: ${error.message}`));
					return;
				}
				const { status, headers, body } = parseCurlOutput(stdout);
				const responseBody = NULL_BODY_STATUSES.has(status) ? null : body;
				resolve(new Response(responseBody, { status, headers }));
			});
			const signal = init?.signal;
			if (signal) {
				if (signal.aborted) {
					child.kill();
					reject(signal.reason);
					return;
				}
				const onAbort = () => {
					child.kill();
					reject(signal.reason);
				};
				signal.addEventListener("abort", onAbort, { once: true });
				child.on("close", () => signal.removeEventListener("abort", onAbort));
			}
		});
	};
}

const defaultExecFile: ExecFileFn = (file, args, options, callback) => {
	return nodeExecFile(file, [...args], options, (error, stdout) => callback(error, stdout));
};

export const fetchCurl: FetchCurl = initFetchCurl({ execFile: defaultExecFile });

function buildCurlArgs(params: { url: string; headers?: Record<string, string> }): string[] {
	const args = [
		"--http2",
		"--silent",
		"--show-error",
		"--location",
		"--max-redirs", String(MAX_REDIRECTS),
		"--dump-header", "-",
		"--output", "-",
		"--compressed",
	];
	if (params.headers) {
		for (const [key, value] of Object.entries(params.headers)) {
			args.push("--header", `${toTitleCase(key)}: ${value}`);
		}
	}
	args.push("--", params.url);
	return args;
}

/**
 * Cloudflare's JA3/JA4 heuristics factor in header name casing for HTTP/1.1.
 * Real browsers send Title-Case headers; lowercase headers signal bot traffic.
 */
function toTitleCase(header: string): string {
	return header.replace(/\b\w/g, (c) => c.toUpperCase());
}

type ParsedCurlOutput = {
	status: number;
	headers: Headers;
	body: Buffer;
};

/**
 * curl --dump-header - --output - writes headers then a blank line then body.
 * With --location, intermediate redirect headers appear before the final ones.
 * We parse the LAST header block (after the last HTTP status line).
 */
function parseCurlOutput(raw: Buffer): ParsedCurlOutput {
	const crlfIndex = findLastHeaderBlock(raw);
	const headerSection = raw.subarray(0, crlfIndex).toString("utf-8");
	const body = raw.subarray(crlfIndex + 4);

	const lines = headerSection.split("\r\n");
	let status = 200;
	const headers = new Headers();

	for (const line of lines) {
		if (line.startsWith("HTTP/")) {
			const parts = line.split(" ");
			status = Number(parts[1]);
			continue;
		}
		const colonIdx = line.indexOf(":");
		if (colonIdx > 0) {
			headers.append(line.substring(0, colonIdx).trim(), line.substring(colonIdx + 1).trim());
		}
	}

	return { status, headers, body };
}

/**
 * Finds the end of the last header block (\r\n\r\n boundary).
 * With --location, each redirect response has its own header block.
 */
function findLastHeaderBlock(raw: Buffer): number {
	const separator = Buffer.from("\r\n\r\n");
	let lastIdx = -1;
	let searchFrom = 0;
	while (true) {
		const idx = raw.indexOf(separator, searchFrom);
		if (idx === -1) break;
		const afterSep = idx + 4;
		const remaining = raw.subarray(afterSep);
		if (remaining.length > 0 && remaining.toString("utf-8", 0, Math.min(5, remaining.length)).startsWith("HTTP/")) {
			lastIdx = idx;
			searchFrom = afterSep;
			continue;
		}
		lastIdx = idx;
		break;
	}
	if (lastIdx === -1) {
		return raw.length;
	}
	return lastIdx;
}
