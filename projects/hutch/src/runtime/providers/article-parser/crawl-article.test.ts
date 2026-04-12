import { initCrawlArticle, DEFAULT_CRAWL_HEADERS } from "./crawl-article";
import { createFakeResponse } from "./fake-response.testutil";

const noopLogError = () => {};

function initCrawl(overrides?: { fetch?: typeof fetch; logError?: (message: string, error?: Error) => void }) {
	return initCrawlArticle({
		fetch: overrides?.fetch ?? (async () => createFakeResponse({ text: "<html></html>" }) as Response),
		logError: overrides?.logError ?? noopLogError,
		headers: { ...DEFAULT_CRAWL_HEADERS },
	});
}

describe("initCrawlArticle — regular first-save fetch", () => {
	it("returns status 'fetched' with html and captured headers on 200", async () => {
		const fakeFetch = (async () =>
			createFakeResponse({
				text: "<html>Hello</html>",
				etag: '"abc123"',
				lastModified: "Wed, 21 Oct 2025 07:28:00 GMT",
			})) as typeof fetch;
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
		const fakeFetch = (async () =>
			createFakeResponse({ text: "<html>Hello</html>" })) as typeof fetch;
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
		const fakeFetch = (async (_input: string | URL | Request, init?: RequestInit) => {
			capturedInit = init;
			return createFakeResponse({ text: "<html></html>" });
		}) as typeof fetch;
		const crawlArticle = initCrawl({ fetch: fakeFetch });

		await crawlArticle({ url: "https://example.com" });

		expect(capturedInit?.headers).toEqual({
			"user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
			accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
			"accept-language": "en-US,en;q=0.9",
		});
	});

	it("passes the URL through to the fetch function unchanged", async () => {
		let capturedUrl: string | undefined;
		const fakeFetch = (async (input: string | URL | Request) => {
			capturedUrl = input as string;
			return createFakeResponse({ text: "<html></html>" });
		}) as typeof fetch;
		const crawlArticle = initCrawl({ fetch: fakeFetch });

		await crawlArticle({ url: "https://example.com/article" });

		expect(capturedUrl).toBe("https://example.com/article");
	});
});

describe("initCrawlArticle — TTL refresh with conditional headers", () => {
	it("returns status 'not-modified' on 304 response", async () => {
		const fakeFetch = (async () =>
			createFakeResponse({ status: 304, ok: false })) as typeof fetch;
		const crawlArticle = initCrawl({ fetch: fakeFetch });

		const result = await crawlArticle({
			url: "https://example.com",
			etag: '"abc123"',
		});

		expect(result).toEqual({ status: "not-modified" });
	});

	it("returns status 'fetched' with fresh headers on 200 conditional response", async () => {
		const fakeFetch = (async () =>
			createFakeResponse({
				text: "<html>New content</html>",
				etag: '"def456"',
				lastModified: "Thu, 22 Oct 2025 10:00:00 GMT",
			})) as typeof fetch;
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
		const fakeFetch = (async (_input: string | URL | Request, init?: RequestInit) => {
			capturedInit = init;
			return createFakeResponse({ status: 304, ok: false });
		}) as typeof fetch;
		const crawlArticle = initCrawl({ fetch: fakeFetch });

		await crawlArticle({ url: "https://example.com", etag: '"abc123"' });

		const headers = capturedInit?.headers as Record<string, string>;
		expect(headers["if-none-match"]).toBe('"abc123"');
		expect(headers["user-agent"]).toBeTruthy();
		expect(headers["accept-language"]).toBeTruthy();
	});

	it("sends If-Modified-Since when lastModified is provided, alongside defaults", async () => {
		let capturedInit: RequestInit | undefined;
		const fakeFetch = (async (_input: string | URL | Request, init?: RequestInit) => {
			capturedInit = init;
			return createFakeResponse({ status: 304, ok: false });
		}) as typeof fetch;
		const crawlArticle = initCrawl({ fetch: fakeFetch });

		await crawlArticle({
			url: "https://example.com",
			lastModified: "Wed, 21 Oct 2025 07:28:00 GMT",
		});

		const headers = capturedInit?.headers as Record<string, string>;
		expect(headers["if-modified-since"]).toBe("Wed, 21 Oct 2025 07:28:00 GMT");
		expect(headers["user-agent"]).toBeTruthy();
	});
});

describe("initCrawlArticle — failure modes", () => {
	it("returns status 'failed' and logs HTTP status when response is not ok and not 304", async () => {
		const fakeFetch = (async () =>
			createFakeResponse({ status: 403, ok: false })) as typeof fetch;
		const logError = jest.fn();
		const crawlArticle = initCrawl({ fetch: fakeFetch, logError });

		const result = await crawlArticle({ url: "https://example.com" });

		expect(result).toEqual({ status: "failed" });
		expect(logError).toHaveBeenCalledWith("[CrawlArticle] HTTP 403 for https://example.com");
	});

	it("returns status 'failed' and logs content-type when not text/html", async () => {
		const fakeFetch = (async () =>
			createFakeResponse({ contentType: "application/json" })) as typeof fetch;
		const logError = jest.fn();
		const crawlArticle = initCrawl({ fetch: fakeFetch, logError });

		const result = await crawlArticle({ url: "https://example.com" });

		expect(result).toEqual({ status: "failed" });
		expect(logError).toHaveBeenCalledWith('[CrawlArticle] Unexpected Content-Type "application/json" for https://example.com');
	});

	it("returns status 'failed' and logs empty content-type when header is missing", async () => {
		const fakeFetch = (async () => {
			const headers = new Headers();
			return { status: 200, ok: true, headers, text: async () => "<html>Content</html>" } as Partial<Response>;
		}) as typeof fetch;
		const logError = jest.fn();
		const crawlArticle = initCrawl({ fetch: fakeFetch, logError });

		const result = await crawlArticle({ url: "https://example.com" });

		expect(result).toEqual({ status: "failed" });
		expect(logError).toHaveBeenCalledWith('[CrawlArticle] Unexpected Content-Type "" for https://example.com');
	});

	it("returns status 'failed' and logs with the Error instance when fetch throws", async () => {
		const networkError = new Error("network down");
		const fakeFetch = (async () => { throw networkError; }) as typeof fetch;
		const logError = jest.fn();
		const crawlArticle = initCrawl({ fetch: fakeFetch, logError });

		const result = await crawlArticle({ url: "https://example.com" });

		expect(result).toEqual({ status: "failed" });
		expect(logError).toHaveBeenCalledWith("[CrawlArticle] Network error for https://example.com", networkError);
	});

	it("returns status 'failed' and logs undefined when fetch throws a non-Error value", async () => {
		const fakeFetch = (async () => { throw "string error"; }) as typeof fetch;
		const logError = jest.fn();
		const crawlArticle = initCrawl({ fetch: fakeFetch, logError });

		const result = await crawlArticle({ url: "https://example.com" });

		expect(result).toEqual({ status: "failed" });
		expect(logError).toHaveBeenCalledWith("[CrawlArticle] Network error for https://example.com", undefined);
	});
});
