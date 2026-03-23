import { initFetchHtml, initFetchHtmlWithHeaders } from "./fetch-html";
import { createFakeResponse } from "./fake-response.testutil";

describe("initFetchHtml", () => {
	it("should return HTML text for a successful response", async () => {
		const fakeFetch = async () =>
			createFakeResponse({ text: "<html>Hello</html>" });
		const fetchHtml = initFetchHtml({ fetch: fakeFetch as typeof fetch });

		const result = await fetchHtml("https://example.com");

		expect(result).toBe("<html>Hello</html>");
	});

	it("should return undefined when response is not ok", async () => {
		const fakeFetch = async () => createFakeResponse({ ok: false });
		const fetchHtml = initFetchHtml({ fetch: fakeFetch as typeof fetch });

		const result = await fetchHtml("https://example.com");

		expect(result).toBeUndefined();
	});

	it("should return undefined when content-type is not text/html", async () => {
		const fakeFetch = async () =>
			createFakeResponse({ contentType: "application/json" });
		const fetchHtml = initFetchHtml({ fetch: fakeFetch as typeof fetch });

		const result = await fetchHtml("https://example.com");

		expect(result).toBeUndefined();
	});

	it("should return undefined when fetch throws", async () => {
		const fakeFetch = async () => {
			throw new Error("network error");
		};
		const fetchHtml = initFetchHtml({ fetch: fakeFetch as typeof fetch });

		const result = await fetchHtml("https://example.com");

		expect(result).toBeUndefined();
	});

	it("should pass the URL to the fetch function", async () => {
		let capturedUrl: string | undefined;
		const fakeFetch = async (input: string | URL | Request) => {
			capturedUrl = input as string;
			return createFakeResponse({ text: "<html></html>" });
		};
		const fetchHtml = initFetchHtml({ fetch: fakeFetch as typeof fetch });

		await fetchHtml("https://example.com/article");

		expect(capturedUrl).toBe("https://example.com/article");
	});

	it("should set accept header to text/html", async () => {
		let capturedInit: RequestInit | undefined;
		const fakeFetch = async (
			_input: string | URL | Request,
			init?: RequestInit,
		) => {
			capturedInit = init;
			return createFakeResponse({ text: "<html></html>" });
		};
		const fetchHtml = initFetchHtml({ fetch: fakeFetch as typeof fetch });

		await fetchHtml("https://example.com");

		expect(capturedInit?.headers).toEqual({ accept: "text/html" });
	});
});

describe("initFetchHtmlWithHeaders", () => {
	it("should return html and captured ETag header", async () => {
		const fakeFetch = async () =>
			createFakeResponse({
				text: "<html>Hello</html>",
				etag: '"abc123"',
			});
		const fetchHtml = initFetchHtmlWithHeaders({ fetch: fakeFetch as typeof fetch });

		const result = await fetchHtml("https://example.com");

		expect(result?.html).toBe("<html>Hello</html>");
		expect(result?.etag).toBe('"abc123"');
	});

	it("should return html and captured Last-Modified header", async () => {
		const fakeFetch = async () =>
			createFakeResponse({
				text: "<html>Hello</html>",
				lastModified: "Wed, 21 Oct 2025 07:28:00 GMT",
			});
		const fetchHtml = initFetchHtmlWithHeaders({ fetch: fakeFetch as typeof fetch });

		const result = await fetchHtml("https://example.com");

		expect(result?.html).toBe("<html>Hello</html>");
		expect(result?.lastModified).toBe("Wed, 21 Oct 2025 07:28:00 GMT");
	});

	it("should return undefined for missing optional headers", async () => {
		const fakeFetch = async () =>
			createFakeResponse({ text: "<html>Hello</html>" });
		const fetchHtml = initFetchHtmlWithHeaders({ fetch: fakeFetch as typeof fetch });

		const result = await fetchHtml("https://example.com");

		expect(result?.html).toBe("<html>Hello</html>");
		expect(result?.etag).toBeUndefined();
		expect(result?.lastModified).toBeUndefined();
	});

	it("should return undefined when response is not ok", async () => {
		const fakeFetch = async () => createFakeResponse({ ok: false });
		const fetchHtml = initFetchHtmlWithHeaders({ fetch: fakeFetch as typeof fetch });

		const result = await fetchHtml("https://example.com");

		expect(result).toBeUndefined();
	});

	it("should return undefined when content-type is not text/html", async () => {
		const fakeFetch = async () =>
			createFakeResponse({ contentType: "application/json" });
		const fetchHtml = initFetchHtmlWithHeaders({ fetch: fakeFetch as typeof fetch });

		const result = await fetchHtml("https://example.com");

		expect(result).toBeUndefined();
	});

	it("should return undefined when fetch throws", async () => {
		const fakeFetch = async () => { throw new Error("network error"); };
		const fetchHtml = initFetchHtmlWithHeaders({ fetch: fakeFetch as typeof fetch });

		const result = await fetchHtml("https://example.com");

		expect(result).toBeUndefined();
	});
});
