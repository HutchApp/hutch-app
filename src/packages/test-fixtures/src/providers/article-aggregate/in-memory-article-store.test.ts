import type { Article, Minutes } from "@packages/domain/article";
import { initInMemoryArticleStore } from "./in-memory-article-store";

function buildArticle(overrides: Partial<Article> = {}): Article {
	return {
		url: "https://example.com/article",
		crawl: { status: "ready" },
		summary: {
			status: "ready",
			summary: "s",
			inputTokens: 1,
			outputTokens: 1,
		},
		metadata: {
			title: "T",
			siteName: "example.com",
			excerpt: "E",
			wordCount: 1,
		},
		estimatedReadTime: 1 as Minutes,
		...overrides,
	};
}

describe("initInMemoryArticleStore", () => {
	it("returns undefined when no row has been seeded", async () => {
		const store = initInMemoryArticleStore();
		const loaded = await store.load("https://example.com/missing");
		expect(loaded).toBeUndefined();
	});

	it("round-trips a seeded aggregate by URL", async () => {
		const store = initInMemoryArticleStore();
		const article = buildArticle();
		store.seed(article);

		const loaded = await store.load(article.url);
		expect(loaded).toEqual(article);
	});

	it("save overwrites the existing article", async () => {
		const store = initInMemoryArticleStore();
		const article = buildArticle();
		store.seed(article);

		const updated = { ...article, summary: { status: "pending" } as const };
		await store.save(updated);

		const peeked = store.peek(article.url);
		expect(peeked?.summary).toEqual({ status: "pending" });
	});

	it("save creates a new entry when no row existed", async () => {
		const store = initInMemoryArticleStore();
		const article = buildArticle();
		await store.save(article);
		expect(store.peek(article.url)).toEqual(article);
	});

	it("canonicalises URLs so different surface forms hit the same row", async () => {
		const store = initInMemoryArticleStore();
		store.seed(
			buildArticle({
				url: "https://example.com/article?utm_source=foo",
			}),
		);

		const loaded = await store.load("https://example.com/article");
		expect(loaded).toBeDefined();
	});
});
