import http2 from "node:http2";
import type { AddressInfo } from "node:net";
import { fetchH2, withH2Fallback } from "./h2-fetch";

type StreamHandler = (stream: http2.ServerHttp2Stream, headers: http2.IncomingHttpHeaders) => void;

async function startH2Server(handler: StreamHandler): Promise<{ origin: string; close: () => Promise<void> }> {
	const server = http2.createServer();
	server.on("stream", handler);
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address() as AddressInfo;
	return {
		origin: `http://127.0.0.1:${address.port}`,
		close: () => new Promise((resolve) => server.close(() => resolve())),
	};
}

describe("fetchH2 — against a local HTTP/2 server", () => {
	it("returns a Response with body and headers for a 200", async () => {
		const server = await startH2Server((stream) => {
			stream.respond({ ":status": 200, "content-type": "text/html", etag: '"abc"' });
			stream.end("<html>hi</html>");
		});
		try {
			const response = await fetchH2(`${server.origin}/`);
			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toBe("text/html");
			expect(response.headers.get("etag")).toBe('"abc"');
			expect(await response.text()).toBe("<html>hi</html>");
		} finally {
			await server.close();
		}
	});

	it("forwards request headers from init.headers", async () => {
		let capturedUa: string | undefined;
		const server = await startH2Server((stream, headers) => {
			capturedUa = typeof headers["user-agent"] === "string" ? headers["user-agent"] : undefined;
			stream.respond({ ":status": 200, "content-type": "text/html" });
			stream.end("<html></html>");
		});
		try {
			await fetchH2(`${server.origin}/`, { headers: { "user-agent": "TestAgent/1.0" } });
			expect(capturedUa).toBe("TestAgent/1.0");
		} finally {
			await server.close();
		}
	});

	it("follows 301 redirects to the final destination", async () => {
		const server = await startH2Server((stream, headers) => {
			if (headers[":path"] === "/start") {
				stream.respond({ ":status": 301, location: "/final" });
				stream.end();
				return;
			}
			stream.respond({ ":status": 200, "content-type": "text/html" });
			stream.end("<html>final</html>");
		});
		try {
			const response = await fetchH2(`${server.origin}/start`);
			expect(response.status).toBe(200);
			expect(await response.text()).toBe("<html>final</html>");
		} finally {
			await server.close();
		}
	});

	it("throws after more than 5 consecutive redirects", async () => {
		const server = await startH2Server((stream, headers) => {
			const match = typeof headers[":path"] === "string" ? headers[":path"].match(/\/hop(\d+)/) : null;
			const n = match ? Number(match[1]) : 0;
			stream.respond({ ":status": 302, location: `/hop${n + 1}` });
			stream.end();
		});
		try {
			await expect(fetchH2(`${server.origin}/hop0`)).rejects.toThrow(/too many redirects/);
		} finally {
			await server.close();
		}
	});

	it("rejects immediately if the signal is already aborted", async () => {
		const server = await startH2Server((stream) => {
			stream.respond({ ":status": 200, "content-type": "text/html" });
			stream.end("<html></html>");
		});
		try {
			const controller = new AbortController();
			controller.abort(new Error("already aborted"));
			await expect(fetchH2(`${server.origin}/`, { signal: controller.signal })).rejects.toThrow("already aborted");
		} finally {
			await server.close();
		}
	});

	it("rejects when the signal aborts mid-request", async () => {
		const server = await startH2Server((stream) => {
			// Never respond — keeps the stream open so we can abort it.
			stream.on("close", () => {});
		});
		try {
			const controller = new AbortController();
			const promise = fetchH2(`${server.origin}/`, { signal: controller.signal });
			setImmediate(() => controller.abort(new Error("mid-flight abort")));
			await expect(promise).rejects.toThrow("mid-flight abort");
		} finally {
			await server.close();
		}
	});
});

describe("withH2Fallback", () => {
	it("passes through non-403 responses unchanged", async () => {
		const baseFetch: typeof fetch = async () =>
			new Response("<html></html>", { status: 200, headers: { "content-type": "text/html" } });
		const h2Impl = jest.fn();
		const wrapped = withH2Fallback(baseFetch, h2Impl as unknown as typeof fetchH2);

		const response = await wrapped("https://example.com");

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("<html></html>");
		expect(h2Impl).not.toHaveBeenCalled();
	});

	it("passes through 403 when server header is not 'cloudflare'", async () => {
		const baseFetch: typeof fetch = async () =>
			new Response("Forbidden", { status: 403, headers: { server: "nginx" } });
		const h2Impl = jest.fn();
		const wrapped = withH2Fallback(baseFetch, h2Impl as unknown as typeof fetchH2);

		const response = await wrapped("https://example.com");

		expect(response.status).toBe(403);
		expect(h2Impl).not.toHaveBeenCalled();
	});

	it("retries via h2 when Cloudflare returns a managed challenge", async () => {
		const baseFetch: typeof fetch = async () =>
			new Response("challenge page", {
				status: 403,
				headers: { server: "cloudflare", "cf-mitigated": "challenge" },
			});
		const h2Impl = jest.fn(async () =>
			new Response("<html>real</html>", { status: 200, headers: { "content-type": "text/html" } }),
		);
		const wrapped = withH2Fallback(baseFetch, h2Impl as unknown as typeof fetchH2);

		const signal = AbortSignal.timeout(5000);
		const response = await wrapped("https://example.com", {
			headers: { "user-agent": "Test/1.0", accept: "text/html" },
			signal,
		});

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("<html>real</html>");
		expect(h2Impl).toHaveBeenCalledWith("https://example.com", {
			headers: { "user-agent": "Test/1.0", accept: "text/html" },
			signal,
		});
	});

	it("retries via h2 on a plain Cloudflare 403 interstitial (no cf-mitigated header)", async () => {
		const baseFetch: typeof fetch = async () =>
			new Response("<html><title>Attention Required! | Cloudflare</title></html>", {
				status: 403,
				headers: { server: "cloudflare" },
			});
		const h2Impl = jest.fn(async () =>
			new Response("<html>real</html>", { status: 200, headers: { "content-type": "text/html" } }),
		);
		const wrapped = withH2Fallback(baseFetch, h2Impl as unknown as typeof fetchH2);

		const response = await wrapped("https://example.com");

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("<html>real</html>");
		expect(h2Impl).toHaveBeenCalledTimes(1);
	});

	it("matches the server header case-insensitively", async () => {
		const baseFetch: typeof fetch = async () =>
			new Response("blocked", { status: 403, headers: { server: "Cloudflare" } });
		const h2Impl = jest.fn(async () =>
			new Response("<html>ok</html>", { status: 200, headers: { "content-type": "text/html" } }),
		);
		const wrapped = withH2Fallback(baseFetch, h2Impl as unknown as typeof fetchH2);

		const response = await wrapped("https://example.com");

		expect(response.status).toBe(200);
		expect(h2Impl).toHaveBeenCalledTimes(1);
	});

	it("passes through 403 when the server header is missing", async () => {
		const baseFetch: typeof fetch = async () =>
			new Response("Forbidden", { status: 403 });
		const h2Impl = jest.fn();
		const wrapped = withH2Fallback(baseFetch, h2Impl as unknown as typeof fetchH2);

		const response = await wrapped("https://example.com");

		expect(response.status).toBe(403);
		expect(h2Impl).not.toHaveBeenCalled();
	});

	it("extracts the URL string from a URL object input", async () => {
		const baseFetch: typeof fetch = async () =>
			new Response("challenge", { status: 403, headers: { server: "cloudflare" } });
		const h2Impl = jest.fn(async () =>
			new Response("<html></html>", { status: 200, headers: { "content-type": "text/html" } }),
		);
		const wrapped = withH2Fallback(baseFetch, h2Impl as unknown as typeof fetchH2);

		await wrapped(new URL("https://example.com/page?q=1"));

		expect(h2Impl).toHaveBeenCalledWith("https://example.com/page?q=1", expect.anything());
	});

	it("extracts the URL from a Request input", async () => {
		const baseFetch: typeof fetch = async () =>
			new Response("challenge", { status: 403, headers: { server: "cloudflare" } });
		const h2Impl = jest.fn(async () =>
			new Response("<html></html>", { status: 200, headers: { "content-type": "text/html" } }),
		);
		const wrapped = withH2Fallback(baseFetch, h2Impl as unknown as typeof fetchH2);

		await wrapped(new Request("https://example.com/other"));

		expect(h2Impl).toHaveBeenCalledWith("https://example.com/other", expect.anything());
	});

	it("normalizes a Headers instance in init.headers to a plain object before passing to h2", async () => {
		const baseFetch: typeof fetch = async () =>
			new Response("challenge", { status: 403, headers: { server: "cloudflare" } });
		const h2Impl = jest.fn(async () =>
			new Response("<html></html>", { status: 200, headers: { "content-type": "text/html" } }),
		);
		const wrapped = withH2Fallback(baseFetch, h2Impl as unknown as typeof fetchH2);

		const headers = new Headers();
		headers.set("user-agent", "Test/1.0");
		headers.set("accept-language", "en-US");
		await wrapped("https://example.com", { headers });

		expect(h2Impl).toHaveBeenCalledWith("https://example.com", {
			headers: { "user-agent": "Test/1.0", "accept-language": "en-US" },
			signal: undefined,
		});
	});

	it("passes undefined headers to h2 when init is omitted", async () => {
		const baseFetch: typeof fetch = async () =>
			new Response("challenge", { status: 403, headers: { server: "cloudflare" } });
		const h2Impl = jest.fn(async () =>
			new Response("<html></html>", { status: 200, headers: { "content-type": "text/html" } }),
		);
		const wrapped = withH2Fallback(baseFetch, h2Impl as unknown as typeof fetchH2);

		await wrapped("https://example.com");

		expect(h2Impl).toHaveBeenCalledWith("https://example.com", {
			headers: undefined,
			signal: undefined,
		});
	});

	it("defaults to the real fetchH2 implementation when no override is given", () => {
		const baseFetch: typeof fetch = async () => new Response("ok", { status: 200 });
		const wrapped = withH2Fallback(baseFetch);
		expect(typeof wrapped).toBe("function");
	});
});
