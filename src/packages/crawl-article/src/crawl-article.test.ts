import assert from "node:assert";
import { initCrawlArticle, DEFAULT_CRAWL_HEADERS } from "./crawl-article";

const noopLogError = () => {};

function initCrawl(overrides?: {
	fetch?: typeof fetch;
	logError?: (message: string, error?: Error) => void;
}) {
	const defaultFetch: typeof fetch = async () =>
		new Response("<html></html>", {
			status: 200,
			headers: { "content-type": "text/html" },
		});
	return initCrawlArticle({
		fetch: overrides?.fetch ?? defaultFetch,
		logError: overrides?.logError ?? noopLogError,
		headers: { ...DEFAULT_CRAWL_HEADERS },
	});
}

function plainHeaders(init: RequestInit | undefined): Record<string, string> {
	assert(init !== undefined, "Expected fetch init to be captured");
	const headers = init.headers;
	assert(headers !== undefined, "Expected init.headers to be set");
	assert(!(headers instanceof Headers), "Expected plain object headers, not Headers instance");
	assert(!Array.isArray(headers), "Expected plain object headers, not array");
	const result: Record<string, string> = {};
	for (const [key, value] of Object.entries(headers)) {
		assert(typeof value === "string", `Expected string header value for "${key}"`);
		result[key] = value;
	}
	return result;
}

describe("initCrawlArticle — regular first-save fetch", () => {
	it("returns status 'fetched' with html and captured headers on 200", async () => {
		const fakeFetch: typeof fetch = async () =>
			new Response("<html>Hello</html>", {
				status: 200,
				headers: {
					"content-type": "text/html",
					etag: '"abc123"',
					"last-modified": "Wed, 21 Oct 2025 07:28:00 GMT",
				},
			});
		const crawlArticle = initCrawl({ fetch: fakeFetch });

		const result = await crawlArticle({ url: "https://example.com" });

		expect(result).toEqual({
			status: "fetched",
			html: "<html>Hello</html>",
			etag: '"abc123"',
			lastModified: "Wed, 21 Oct 2025 07:28:00 GMT",
		});
	});

	it("returns status 'fetched' with undefined etag/lastModified when origin sends none", async () => {
		const fakeFetch: typeof fetch = async () =>
			new Response("<html>Hello</html>", {
				status: 200,
				headers: { "content-type": "text/html" },
			});
		const crawlArticle = initCrawl({ fetch: fakeFetch });

		const result = await crawlArticle({ url: "https://example.com" });

		expect(result).toEqual({
			status: "fetched",
			html: "<html>Hello</html>",
			etag: undefined,
			lastModified: undefined,
		});
	});

	it("sends the browser-like default headers on the first fetch", async () => {
		let capturedInit: RequestInit | undefined;
		const fakeFetch: typeof fetch = async (_input, init) => {
			capturedInit = init;
			return new Response("<html></html>", {
				status: 200,
				headers: { "content-type": "text/html" },
			});
		};
		const crawlArticle = initCrawl({ fetch: fakeFetch });

		await crawlArticle({ url: "https://example.com" });

		expect(plainHeaders(capturedInit)).toEqual({
			"user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
			accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
			"accept-language": "en-US,en;q=0.9",
		});
	});

	it("passes the URL through to the fetch function unchanged", async () => {
		let capturedInput: unknown;
		const fakeFetch: typeof fetch = async (input) => {
			capturedInput = input;
			return new Response("<html></html>", {
				status: 200,
				headers: { "content-type": "text/html" },
			});
		};
		const crawlArticle = initCrawl({ fetch: fakeFetch });

		await crawlArticle({ url: "https://example.com/article" });

		expect(capturedInput).toBe("https://example.com/article");
	});
});

describe("initCrawlArticle — TTL refresh with conditional headers", () => {
	it("returns status 'not-modified' on 304 response", async () => {
		const fakeFetch: typeof fetch = async () => new Response(null, { status: 304 });
		const crawlArticle = initCrawl({ fetch: fakeFetch });

		const result = await crawlArticle({
			url: "https://example.com",
			etag: '"abc123"',
		});

		expect(result).toEqual({ status: "not-modified" });
	});

	it("returns status 'fetched' with fresh headers on 200 conditional response", async () => {
		const fakeFetch: typeof fetch = async () =>
			new Response("<html>New content</html>", {
				status: 200,
				headers: {
					"content-type": "text/html",
					etag: '"def456"',
					"last-modified": "Thu, 22 Oct 2025 10:00:00 GMT",
				},
			});
		const crawlArticle = initCrawl({ fetch: fakeFetch });

		const result = await crawlArticle({
			url: "https://example.com",
			etag: '"abc123"',
			lastModified: "Wed, 21 Oct 2025 07:28:00 GMT",
		});

		expect(result).toEqual({
			status: "fetched",
			html: "<html>New content</html>",
			etag: '"def456"',
			lastModified: "Thu, 22 Oct 2025 10:00:00 GMT",
		});
	});

	it("sends If-None-Match when etag is provided, alongside defaults", async () => {
		let capturedInit: RequestInit | undefined;
		const fakeFetch: typeof fetch = async (_input, init) => {
			capturedInit = init;
			return new Response(null, { status: 304 });
		};
		const crawlArticle = initCrawl({ fetch: fakeFetch });

		await crawlArticle({ url: "https://example.com", etag: '"abc123"' });

		const headers = plainHeaders(capturedInit);
		expect(headers["if-none-match"]).toBe('"abc123"');
		expect(headers["user-agent"]).toBeTruthy();
		expect(headers["accept-language"]).toBeTruthy();
	});

	it("sends If-Modified-Since when lastModified is provided, alongside defaults", async () => {
		let capturedInit: RequestInit | undefined;
		const fakeFetch: typeof fetch = async (_input, init) => {
			capturedInit = init;
			return new Response(null, { status: 304 });
		};
		const crawlArticle = initCrawl({ fetch: fakeFetch });

		await crawlArticle({
			url: "https://example.com",
			lastModified: "Wed, 21 Oct 2025 07:28:00 GMT",
		});

		const headers = plainHeaders(capturedInit);
		expect(headers["if-modified-since"]).toBe("Wed, 21 Oct 2025 07:28:00 GMT");
		expect(headers["user-agent"]).toBeTruthy();
	});
});

describe("initCrawlArticle — failure modes", () => {
	it("returns status 'failed' and logs HTTP status when response is not ok and not 304", async () => {
		const fakeFetch: typeof fetch = async () => new Response(null, { status: 403 });
		const logError = jest.fn();
		const crawlArticle = initCrawl({ fetch: fakeFetch, logError });

		const result = await crawlArticle({ url: "https://example.com" });

		expect(result).toEqual({ status: "failed" });
		expect(logError).toHaveBeenCalledWith("[CrawlArticle] HTTP 403 for https://example.com");
	});

	it("returns status 'failed' and logs content-type when not text/html", async () => {
		const fakeFetch: typeof fetch = async () =>
			new Response("{}", {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		const logError = jest.fn();
		const crawlArticle = initCrawl({ fetch: fakeFetch, logError });

		const result = await crawlArticle({ url: "https://example.com" });

		expect(result).toEqual({ status: "failed" });
		expect(logError).toHaveBeenCalledWith('[CrawlArticle] Unexpected Content-Type "application/json" for https://example.com');
	});

	it("returns status 'failed' and logs empty content-type when header is missing", async () => {
		// Buffer body bypasses Response's auto-assigned text/plain Content-Type, so headers.get returns null
		const fakeFetch: typeof fetch = async () =>
			new Response(Buffer.from("<html>Content</html>"), { status: 200, headers: {} });
		const logError = jest.fn();
		const crawlArticle = initCrawl({ fetch: fakeFetch, logError });

		const result = await crawlArticle({ url: "https://example.com" });

		expect(result).toEqual({ status: "failed" });
		expect(logError).toHaveBeenCalledWith('[CrawlArticle] Unexpected Content-Type "" for https://example.com');
	});

	it("returns status 'failed' and logs with the Error instance when fetch throws", async () => {
		const networkError = new Error("network down");
		const fakeFetch: typeof fetch = async () => { throw networkError; };
		const logError = jest.fn();
		const crawlArticle = initCrawl({ fetch: fakeFetch, logError });

		const result = await crawlArticle({ url: "https://example.com" });

		expect(result).toEqual({ status: "failed" });
		expect(logError).toHaveBeenCalledWith("[CrawlArticle] Network error for https://example.com", networkError);
	});

	it("returns status 'failed' and logs undefined when fetch throws a non-Error value", async () => {
		const fakeFetch: typeof fetch = async () => { throw "string error"; };
		const logError = jest.fn();
		const crawlArticle = initCrawl({ fetch: fakeFetch, logError });

		const result = await crawlArticle({ url: "https://example.com" });

		expect(result).toEqual({ status: "failed" });
		expect(logError).toHaveBeenCalledWith("[CrawlArticle] Network error for https://example.com", undefined);
	});
});
