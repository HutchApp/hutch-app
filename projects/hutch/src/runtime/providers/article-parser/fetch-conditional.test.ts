import { initFetchConditional } from "./fetch-conditional";
import { createFakeResponse } from "./fake-response.testutil";

describe("initFetchConditional", () => {
	it("should return changed: false on 304 response", async () => {
		const fakeFetch = async () => createFakeResponse({ status: 304, ok: false });
		const fetchConditional = initFetchConditional({ fetch: fakeFetch as typeof fetch });

		const result = await fetchConditional({
			url: "https://example.com",
			etag: '"abc123"',
		});

		expect(result).toEqual({ changed: false });
	});

	it("should return changed: true with html and headers on 200 response", async () => {
		const fakeFetch = async () =>
			createFakeResponse({
				text: "<html>New</html>",
				etag: '"def456"',
				lastModified: "Thu, 22 Oct 2025 10:00:00 GMT",
			});
		const fetchConditional = initFetchConditional({ fetch: fakeFetch as typeof fetch });

		const result = await fetchConditional({
			url: "https://example.com",
			etag: '"abc123"',
		});

		expect(result).toEqual({
			changed: true,
			html: "<html>New</html>",
			etag: '"def456"',
			lastModified: "Thu, 22 Oct 2025 10:00:00 GMT",
		});
	});

	it("should send If-None-Match header when etag is provided", async () => {
		let capturedInit: RequestInit | undefined;
		const fakeFetch = async (_input: string | URL | Request, init?: RequestInit) => {
			capturedInit = init;
			return createFakeResponse({ status: 304, ok: false });
		};
		const fetchConditional = initFetchConditional({ fetch: fakeFetch as typeof fetch });

		await fetchConditional({ url: "https://example.com", etag: '"abc123"' });

		const headers = capturedInit?.headers as Record<string, string>;
		expect(headers["if-none-match"]).toBe('"abc123"');
	});

	it("should send If-Modified-Since header when lastModified is provided", async () => {
		let capturedInit: RequestInit | undefined;
		const fakeFetch = async (_input: string | URL | Request, init?: RequestInit) => {
			capturedInit = init;
			return createFakeResponse({ status: 304, ok: false });
		};
		const fetchConditional = initFetchConditional({ fetch: fakeFetch as typeof fetch });

		await fetchConditional({
			url: "https://example.com",
			lastModified: "Wed, 21 Oct 2025 07:28:00 GMT",
		});

		const headers = capturedInit?.headers as Record<string, string>;
		expect(headers["if-modified-since"]).toBe("Wed, 21 Oct 2025 07:28:00 GMT");
	});

	it("should return changed: true with undefined headers when origin sends no etag/lastModified", async () => {
		const fakeFetch = async () =>
			createFakeResponse({ text: "<html>Content</html>" });
		const fetchConditional = initFetchConditional({ fetch: fakeFetch as typeof fetch });

		const result = await fetchConditional({
			url: "https://example.com",
			etag: '"old"',
		});

		expect(result).toEqual({
			changed: true,
			html: "<html>Content</html>",
			etag: undefined,
			lastModified: undefined,
		});
	});

	it("should return changed: false on non-304 error status", async () => {
		const fakeFetch = async () => createFakeResponse({ status: 500, ok: false });
		const fetchConditional = initFetchConditional({ fetch: fakeFetch as typeof fetch });

		const result = await fetchConditional({
			url: "https://example.com",
			etag: '"abc123"',
		});

		expect(result).toEqual({ changed: false });
	});

	it("should return changed: true with both etag and lastModified from response", async () => {
		const fakeFetch = async () =>
			createFakeResponse({
				text: "<html>Content</html>",
				etag: '"new-etag"',
				lastModified: "Thu, 22 Oct 2025 10:00:00 GMT",
			});
		const fetchConditional = initFetchConditional({ fetch: fakeFetch as typeof fetch });

		const result = await fetchConditional({
			url: "https://example.com",
			etag: '"old-etag"',
			lastModified: "Wed, 21 Oct 2025 07:28:00 GMT",
		});

		expect(result).toEqual({
			changed: true,
			html: "<html>Content</html>",
			etag: '"new-etag"',
			lastModified: "Thu, 22 Oct 2025 10:00:00 GMT",
		});
	});

	it("should return changed: false on fetch error", async () => {
		const fakeFetch = async () => { throw new Error("network error"); };
		const fetchConditional = initFetchConditional({ fetch: fakeFetch as typeof fetch });

		const result = await fetchConditional({
			url: "https://example.com",
			etag: '"abc123"',
		});

		expect(result).toEqual({ changed: false });
	});

	it("should return changed: false on non-HTML 200 response", async () => {
		const fakeFetch = async () =>
			createFakeResponse({ contentType: "application/json", text: "{}" });
		const fetchConditional = initFetchConditional({ fetch: fakeFetch as typeof fetch });

		const result = await fetchConditional({
			url: "https://example.com",
			etag: '"abc123"',
		});

		expect(result).toEqual({ changed: false });
	});

	it("should return changed: false when content-type header is missing", async () => {
		const fakeFetch = async (): Promise<Partial<Response>> => {
			const headers = new Headers();
			return { status: 200, ok: true, headers, text: async () => "<html>Content</html>" };
		};
		const fetchConditional = initFetchConditional({ fetch: fakeFetch as typeof fetch });

		const result = await fetchConditional({
			url: "https://example.com",
			etag: '"abc123"',
		});

		expect(result).toEqual({ changed: false });
	});
});
