import { SaveArticleInputSchema, SaveHtmlInputSchema, SAVEABLE_URL_SCHEMES } from "./article.schema";

describe("SaveArticleInputSchema", () => {
	it("accepts a valid URL", () => {
		const result = SaveArticleInputSchema.safeParse({ url: "https://example.com/article" });

		expect(result.success).toBe(true);
	});

	it("accepts an http URL", () => {
		const result = SaveArticleInputSchema.safeParse({ url: "http://example.com/article" });

		expect(result.success).toBe(true);
	});

	it("rejects a missing url field", () => {
		const result = SaveArticleInputSchema.safeParse({});

		expect(result.success).toBe(false);
	});

	it("rejects an invalid URL string", () => {
		const result = SaveArticleInputSchema.safeParse({ url: "not-a-url" });

		expect(result.success).toBe(false);
	});

	it("rejects non-saveable schemes", () => {
		for (const url of [
			"chrome://newtab/",
			"about:blank",
			"file:///etc/hosts",
			"view-source:https://example.com",
			"ftp://example.com/file",
		]) {
			const result = SaveArticleInputSchema.safeParse({ url });
			expect(result.success).toBe(false);
		}
	});
});

describe("SaveHtmlInputSchema", () => {
	it("rejects non-saveable schemes", () => {
		const result = SaveHtmlInputSchema.safeParse({
			url: "chrome://newtab/",
			rawHtml: "<html></html>",
		});

		expect(result.success).toBe(false);
	});
});

describe("SAVEABLE_URL_SCHEMES", () => {
	it("publishes http and https as saveable", () => {
		expect(SAVEABLE_URL_SCHEMES).toEqual(["http", "https"]);
	});
});
