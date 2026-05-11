import type { Article, Minutes } from "@packages/domain/article";
import { AggregateConcurrencyError } from "@packages/domain/article";
import { initInMemoryArticleStore } from "./in-memory-article-store";

function buildArticle(overrides: Partial<Article> = {}): Article {
	return {
		url: "https://example.com/article",
		version: 1,
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
		const article = buildArticle({ version: 5 });
		store.seed(article);

		const loaded = await store.load(article.url);
		expect(loaded).toEqual(article);
	});

	it("first save against a pre-aggregate row writes version 1", async () => {
		// version=0 simulates a pre-aggregate row projected by the DDB
		// adapter when the `version` attribute is absent. The first
		// aggregate write turns it into version 1.
		const store = initInMemoryArticleStore();
		const fresh = buildArticle({ version: 0 });
		await store.save({ article: fresh, expectedVersion: 0 });
		expect(store.peek(fresh.url)?.version).toBe(1);
	});

	it("save with the matching expectedVersion bumps the on-disk version by one", async () => {
		const store = initInMemoryArticleStore();
		const article = buildArticle({ version: 7 });
		store.seed(article);

		await store.save({
			article: { ...article, summary: { status: "pending" } },
			expectedVersion: 7,
		});

		const peeked = store.peek(article.url);
		expect(peeked?.version).toBe(8);
		expect(peeked?.summary).toEqual({ status: "pending" });
	});

	it("save with a stale expectedVersion throws AggregateConcurrencyError", async () => {
		const store = initInMemoryArticleStore();
		store.seed(buildArticle({ version: 10 }));

		await expect(
			store.save({
				article: buildArticle({ version: 10 }),
				expectedVersion: 9,
			}),
		).rejects.toBeInstanceOf(AggregateConcurrencyError);
	});

	it("save against a missing row with expectedVersion>0 throws AggregateConcurrencyError", async () => {
		const store = initInMemoryArticleStore();
		await expect(
			store.save({
				article: buildArticle(),
				expectedVersion: 4,
			}),
		).rejects.toBeInstanceOf(AggregateConcurrencyError);
	});

	it("canonicalises URLs so different surface forms hit the same row", async () => {
		// The production DDB adapter uses ArticleResourceUniqueId to derive
		// the partition key. The in-memory store must match that contract or
		// tests that mix the original and canonical URL will see a phantom
		// "row not found" the production code would never see.
		const store = initInMemoryArticleStore();
		store.seed(
			buildArticle({
				url: "https://example.com/article?utm_source=foo",
				version: 3,
			}),
		);

		const loaded = await store.load("https://example.com/article");
		expect(loaded?.version).toBe(3);
	});
});
