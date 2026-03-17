import { SaveArticleInputSchema } from "./article.schema";

describe("SaveArticleInputSchema", () => {
	it("accepts a valid URL", () => {
		const result = SaveArticleInputSchema.safeParse({ url: "https://example.com/article" });

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
});
