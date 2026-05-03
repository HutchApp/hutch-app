import { initFetchCurl } from "./curl-fetch";

type ExecFileCallback = (error: Error | null, stdout: Buffer) => void;
type ExecFileStub = (
	file: string,
	args: readonly string[],
	options: { encoding: "buffer"; maxBuffer: number; timeout: number | undefined },
	callback: ExecFileCallback,
) => { kill: () => boolean; on: (event: string, listener: () => void) => void };

function createStubReturning(stdout: Buffer): ExecFileStub {
	return (_file, _args, _options, callback) => {
		setImmediate(() => callback(null, stdout));
		return { kill: () => true, on: () => {} };
	};
}

describe("initFetchCurl", () => {
	it("returns a Response with status, headers, and body from curl output", async () => {
		const stdout = Buffer.from(
			"HTTP/1.1 200 OK\r\ncontent-type: text/html\r\nserver: nginx\r\n\r\n<html>hello</html>",
		);
		const fetchCurl = initFetchCurl({ execFile: createStubReturning(stdout) });

		const response = await fetchCurl("https://example.com");

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("text/html");
		expect(response.headers.get("server")).toBe("nginx");
		expect(await response.text()).toBe("<html>hello</html>");
	});

	it("parses the final response after a redirect chain", async () => {
		const stdout = Buffer.from(
			[
				"HTTP/1.1 301 Moved Permanently\r\nlocation: /new-path\r\n\r\n",
				"HTTP/1.1 200 OK\r\ncontent-type: text/html\r\n\r\n<html>final</html>",
			].join(""),
		);
		const fetchCurl = initFetchCurl({ execFile: createStubReturning(stdout) });

		const response = await fetchCurl("https://example.com");

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("text/html");
		expect(await response.text()).toBe("<html>final</html>");
	});

	it("returns a 403 response from curl output", async () => {
		const stdout = Buffer.from(
			"HTTP/2 403 \r\nserver: cloudflare\r\n\r\nForbidden",
		);
		const fetchCurl = initFetchCurl({ execFile: createStubReturning(stdout) });

		const response = await fetchCurl("https://example.com");

		expect(response.status).toBe(403);
		expect(response.headers.get("server")).toBe("cloudflare");
		expect(await response.text()).toBe("Forbidden");
	});

	it("handles empty body", async () => {
		const stdout = Buffer.from("HTTP/1.1 204 No Content\r\n\r\n");
		const fetchCurl = initFetchCurl({ execFile: createStubReturning(stdout) });

		const response = await fetchCurl("https://example.com");

		expect(response.status).toBe(204);
		expect(await response.text()).toBe("");
	});

	it("handles binary body content", async () => {
		const headerPart = "HTTP/1.1 200 OK\r\ncontent-type: image/png\r\n\r\n";
		const binaryBody = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
		const stdout = Buffer.concat([Buffer.from(headerPart), binaryBody]);
		const fetchCurl = initFetchCurl({ execFile: createStubReturning(stdout) });

		const response = await fetchCurl("https://example.com");

		expect(response.status).toBe(200);
		const body = Buffer.from(await response.arrayBuffer());
		expect(body).toEqual(binaryBody);
	});

	it("passes --http2 and title-cased custom headers to curl", async () => {
		let capturedArgs: readonly string[] = [];
		const execFileStub: ExecFileStub = (_file, args, _options, callback) => {
			capturedArgs = args;
			setImmediate(() => callback(null, Buffer.from("HTTP/1.1 200 OK\r\n\r\n")));
			return { kill: () => true, on: () => {} };
		};
		const fetchCurl = initFetchCurl({ execFile: execFileStub });

		await fetchCurl("https://example.com/path", { headers: { "user-agent": "Bot/1.0", "accept-language": "en" } });

		expect(capturedArgs).toContain("--http2");
		expect(capturedArgs).toContain("--compressed");
		expect(capturedArgs).toContain("https://example.com/path");
		const headerIdx = capturedArgs.indexOf("--header");
		expect(headerIdx).toBeGreaterThan(-1);
		expect(capturedArgs[headerIdx + 1]).toBe("User-Agent: Bot/1.0");
	});

	it("rejects with an error message when curl subprocess fails", async () => {
		const execFileStub: ExecFileStub = (_file, _args, _options, callback) => {
			setImmediate(() => callback(new Error("Connection refused"), Buffer.alloc(0)));
			return { kill: () => true, on: () => {} };
		};
		const fetchCurl = initFetchCurl({ execFile: execFileStub });

		await expect(fetchCurl("https://example.com")).rejects.toThrow(
			"fetchCurl failed for https://example.com: Connection refused",
		);
	});

	it("kills the subprocess when the signal is already aborted", async () => {
		let killed = false;
		const execFileStub: ExecFileStub = (_file, _args, _options, _callback) => {
			return { kill: () => { killed = true; return true; }, on: () => {} };
		};
		const fetchCurl = initFetchCurl({ execFile: execFileStub });
		const controller = new AbortController();
		controller.abort(new Error("pre-aborted"));

		await expect(fetchCurl("https://example.com", { signal: controller.signal })).rejects.toThrow("pre-aborted");
		expect(killed).toBe(true);
	});

	it("kills the subprocess on mid-flight abort", async () => {
		let killed = false;
		let closeListener: (() => void) | undefined;
		const execFileStub: ExecFileStub = (_file, _args, _options, _callback) => {
			return {
				kill: () => { killed = true; return true; },
				on: (_event, listener) => { closeListener = listener; },
			};
		};
		const fetchCurl = initFetchCurl({ execFile: execFileStub });
		const controller = new AbortController();

		const promise = fetchCurl("https://example.com", { signal: controller.signal });
		controller.abort(new Error("mid-flight"));

		await expect(promise).rejects.toThrow("mid-flight");
		expect(killed).toBe(true);
		expect(closeListener).toBeDefined();
	});

	it("uses DEFAULT_TIMEOUT_MS when no signal is provided", async () => {
		let capturedTimeout: number | undefined;
		const execFileStub: ExecFileStub = (_file, _args, options, callback) => {
			capturedTimeout = options.timeout;
			setImmediate(() => callback(null, Buffer.from("HTTP/1.1 200 OK\r\n\r\n")));
			return { kill: () => true, on: () => {} };
		};
		const fetchCurl = initFetchCurl({ execFile: execFileStub });

		await fetchCurl("https://example.com");

		expect(capturedTimeout).toBe(10000);
	});

	it("disables timeout when signal is provided", async () => {
		let capturedTimeout: number | undefined;
		const execFileStub: ExecFileStub = (_file, _args, options, callback) => {
			capturedTimeout = options.timeout;
			setImmediate(() => callback(null, Buffer.from("HTTP/1.1 200 OK\r\n\r\n")));
			return { kill: () => true, on: () => {} };
		};
		const fetchCurl = initFetchCurl({ execFile: execFileStub });

		await fetchCurl("https://example.com", { signal: AbortSignal.timeout(5000) });

		expect(capturedTimeout).toBeUndefined();
	});
});
