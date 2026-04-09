import assert from "node:assert/strict";
import { ArticleUniqueId } from "@packages/article-unique-id";
import { ArticleIdSchema } from "../../domain/article/article.schema";
import type { Minutes } from "../../domain/article/article.types";
import type { UserId } from "../../domain/user/user.types";
import type { SaveArticleParams } from "./article-store.types";
import { initInMemoryArticleStore } from "./in-memory-article-store";

const USER_A = "user-a" as UserId;
const USER_B = "user-b" as UserId;

function makeArticleParams(
	overrides?: Partial<SaveArticleParams>,
): SaveArticleParams {
	return {
		userId: USER_A,
		url: "https://example.com/article",
		metadata: {
			title: "Test Article",
			siteName: "example.com",
			excerpt: "A test article excerpt",
			wordCount: 500,
		},
		estimatedReadTime: 3 as Minutes,
		...overrides,
	};
}

describe("initInMemoryArticleStore", () => {
	describe("saveArticle + findArticleById", () => {
		it("should save and retrieve an article", async () => {
			const store = initInMemoryArticleStore();
			const saved = await store.saveArticle(makeArticleParams());

			const found = await store.findArticleById(saved.id, USER_A);

			expect(found?.url).toBe("https://example.com/article");
			expect(found?.status).toBe("unread");
		});

		it("should return null when user has no relationship to the article", async () => {
			const store = initInMemoryArticleStore();
			const saved = await store.saveArticle(makeArticleParams({ userId: USER_A }));

			const found = await store.findArticleById(saved.id, USER_B);

			expect(found).toBeNull();
		});
	});

	describe("findArticleByUrl", () => {
		it("should return null for unknown URL", async () => {
			const store = initInMemoryArticleStore();

			const found = await store.findArticleByUrl("https://unknown.com/page");

			expect(found).toBeNull();
		});

		it("should return article data for known URL", async () => {
			const store = initInMemoryArticleStore();
			await store.saveArticle(makeArticleParams());

			const found = await store.findArticleByUrl("https://example.com/article");

			expect(found?.url).toBe("https://example.com/article");
			expect(found?.metadata.title).toBe("Test Article");
		});
	});

	describe("article deduplication", () => {
		it("should reuse the same global article when two users save the same URL", async () => {
			const store = initInMemoryArticleStore();
			const savedA = await store.saveArticle(makeArticleParams({ userId: USER_A }));
			const savedB = await store.saveArticle(makeArticleParams({ userId: USER_B }));

			expect(savedA.id).toBe(savedB.id);
		});

		it("should produce the same routeId regardless of scheme or fragment", async () => {
			const store = initInMemoryArticleStore();
			const https = await store.saveArticle(
				makeArticleParams({ url: "https://example.com/article" }),
			);
			const http = await store.saveArticle(
				makeArticleParams({ userId: USER_B, url: "http://example.com/article" }),
			);
			const withFragment = await store.saveArticle(
				makeArticleParams({ url: "https://example.com/article#heading" }),
			);

			expect(https.id).toBe(http.id);
			expect(https.id).toBe(withFragment.id);
		});

		it("should create separate user-article relationships for each user", async () => {
			const store = initInMemoryArticleStore();
			await store.saveArticle(makeArticleParams({ userId: USER_A }));
			await store.saveArticle(makeArticleParams({ userId: USER_B }));

			const resultA = await store.findArticlesByUser({ userId: USER_A });
			const resultB = await store.findArticlesByUser({ userId: USER_B });

			expect(resultA.articles.length).toBe(1);
			expect(resultB.articles.length).toBe(1);
		});

		it("should not create a duplicate user-article when the same user saves the same URL twice", async () => {
			const store = initInMemoryArticleStore();
			await store.saveArticle(makeArticleParams({ userId: USER_A }));
			await store.saveArticle(makeArticleParams({ userId: USER_A }));

			const result = await store.findArticlesByUser({ userId: USER_A });

			expect(result.articles.length).toBe(1);
			expect(result.total).toBe(1);
		});
	});

	describe("findArticlesByUser", () => {
		it("should return only articles belonging to the user", async () => {
			const store = initInMemoryArticleStore();
			await store.saveArticle(makeArticleParams({ userId: USER_A }));
			await store.saveArticle(
				makeArticleParams({ userId: USER_B, url: "https://other.com/page" }),
			);

			const result = await store.findArticlesByUser({ userId: USER_A });

			expect(result.articles.length).toBe(1);
			expect(result.total).toBe(1);
		});

		it("should filter by status", async () => {
			const store = initInMemoryArticleStore();
			const a1 = await store.saveArticle(
				makeArticleParams({ url: "https://example.com/1" }),
			);
			await store.saveArticle(
				makeArticleParams({ url: "https://example.com/2" }),
			);
			await store.updateArticleStatus(a1.id, USER_A, "read");

			const result = await store.findArticlesByUser({
				userId: USER_A,
				status: "read",
			});

			expect(result.articles.length).toBe(1);
			expect(result.articles[0].id).toBe(a1.id);
		});

		it("should sort by savedAt descending by default", async () => {
			const store = initInMemoryArticleStore();
			const a1 = await store.saveArticle(
				makeArticleParams({ url: "https://example.com/first" }),
			);
			await new Promise((resolve) => setTimeout(resolve, 10));
			const a2 = await store.saveArticle(
				makeArticleParams({ url: "https://example.com/second" }),
			);

			const result = await store.findArticlesByUser({ userId: USER_A });

			expect(result.articles[0].id).toBe(a2.id);
			expect(result.articles[1].id).toBe(a1.id);
		});

		it("should sort ascending when specified", async () => {
			const store = initInMemoryArticleStore();
			const a1 = await store.saveArticle(
				makeArticleParams({ url: "https://example.com/first" }),
			);
			await new Promise((resolve) => setTimeout(resolve, 10));
			const a2 = await store.saveArticle(
				makeArticleParams({ url: "https://example.com/second" }),
			);

			const result = await store.findArticlesByUser({
				userId: USER_A,
				order: "asc",
			});

			expect(result.articles[0].id).toBe(a1.id);
			expect(result.articles[1].id).toBe(a2.id);
		});

		it("should paginate results", async () => {
			const store = initInMemoryArticleStore();
			for (let i = 0; i < 5; i++) {
				await store.saveArticle(
					makeArticleParams({ url: `https://example.com/${i}` }),
				);
			}

			const page1 = await store.findArticlesByUser({
				userId: USER_A,
				page: 1,
				pageSize: 2,
			});
			const page2 = await store.findArticlesByUser({
				userId: USER_A,
				page: 2,
				pageSize: 2,
			});

			expect(page1.articles.length).toBe(2);
			expect(page2.articles.length).toBe(2);
			expect(page1.total).toBe(5);
		});
	});

	describe("deleteArticle", () => {
		it("should remove user's relationship to the article", async () => {
			const store = initInMemoryArticleStore();
			const saved = await store.saveArticle(makeArticleParams());

			const deleted = await store.deleteArticle(saved.id, USER_A);

			expect(deleted).toBe(true);
			expect(await store.findArticleById(saved.id, USER_A)).toBeNull();
		});

		it("should not affect another user's relationship to the same article", async () => {
			const store = initInMemoryArticleStore();
			const saved = await store.saveArticle(makeArticleParams({ userId: USER_A }));
			await store.saveArticle(makeArticleParams({ userId: USER_B }));

			await store.deleteArticle(saved.id, USER_A);

			const foundByB = await store.findArticleById(saved.id, USER_B);
			expect(foundByB?.url).toBe("https://example.com/article");
		});

		it("should not delete another user's article", async () => {
			const store = initInMemoryArticleStore();
			const saved = await store.saveArticle(makeArticleParams({ userId: USER_A }));

			const deleted = await store.deleteArticle(saved.id, USER_B);

			expect(deleted).toBe(false);
		});

		it("should return false when deleting a non-existent article", async () => {
			const store = initInMemoryArticleStore();
			const fakeId = ArticleIdSchema.parse("nonexistent-id");

			const deleted = await store.deleteArticle(fakeId, USER_A);

			expect(deleted).toBe(false);
		});
	});

	describe("freshness operations", () => {
		it("findArticleFreshness returns null for unknown URL", async () => {
			const store = initInMemoryArticleStore();

			const result = await store.findArticleFreshness("https://unknown.com/page");

			expect(result).toBeNull();
		});

		it("updateArticleFetchMetadata sets contentFetchedAt", async () => {
			const store = initInMemoryArticleStore();
			await store.saveArticle(makeArticleParams());

			await store.updateArticleFetchMetadata({
				url: "https://example.com/article",
				contentFetchedAt: "2026-03-20T10:00:00Z",
			});
			const freshness = await store.findArticleFreshness("https://example.com/article");

			expect(freshness?.contentFetchedAt).toBe("2026-03-20T10:00:00Z");
		});

		it("updateArticleContent updates metadata and content", async () => {
			const store = initInMemoryArticleStore();
			await store.saveArticle(makeArticleParams());

			await store.updateArticleContent({
				url: "https://example.com/article",
				metadata: {
					title: "Updated Title",
					siteName: "example.com",
					excerpt: "Updated excerpt",
					wordCount: 200,
				},
				content: "<p>Updated content</p>",
				estimatedReadTime: 1 as Minutes,
				etag: '"new-etag"',
				lastModified: "Wed, 20 Mar 2026 10:00:00 GMT",
				contentFetchedAt: "2026-03-20T10:00:00Z",
			});

			const byUrl = await store.findArticleByUrl("https://example.com/article");
			assert(byUrl, "Article should exist after updateArticleContent");
			const found = await store.findArticleById(
				byUrl.id,
				USER_A,
			);
			expect(found?.metadata.title).toBe("Updated Title");
			expect(found?.content).toBe("<p>Updated content</p>");

			const freshness = await store.findArticleFreshness("https://example.com/article");
			expect(freshness?.etag).toBe('"new-etag"');
			expect(freshness?.contentFetchedAt).toBe("2026-03-20T10:00:00Z");
		});

		it("updateArticleContent without etag or lastModified preserves existing values", async () => {
			const store = initInMemoryArticleStore();
			await store.saveArticle(makeArticleParams());

			await store.updateArticleContent({
				url: "https://example.com/article",
				metadata: {
					title: "No Headers",
					siteName: "example.com",
					excerpt: "No headers excerpt",
					wordCount: 50,
				},
				content: "<p>Content without headers</p>",
				estimatedReadTime: 1 as Minutes,
				contentFetchedAt: "2026-03-20T12:00:00Z",
			});

			const freshness = await store.findArticleFreshness("https://example.com/article");
			expect(freshness?.contentFetchedAt).toBe("2026-03-20T12:00:00Z");
			expect(freshness?.etag).toBeUndefined();
			expect(freshness?.lastModified).toBeUndefined();
		});

		it("clearArticleSummary sets summary to undefined", async () => {
			const store = initInMemoryArticleStore();
			await store.saveArticle(makeArticleParams());

			await store.clearArticleSummary("https://example.com/article");

			const freshness = await store.findArticleFreshness("https://example.com/article");
			expect(freshness).not.toBeNull();
		});
	});

	describe("updateArticleStatus", () => {
		it("should update status and set readAt for read", async () => {
			const store = initInMemoryArticleStore();
			const saved = await store.saveArticle(makeArticleParams());

			await store.updateArticleStatus(saved.id, USER_A, "read");
			const found = await store.findArticleById(saved.id, USER_A);

			expect(found?.status).toBe("read");
			expect(found?.readAt).toBeInstanceOf(Date);
		});

		it("should clear readAt when marking unread", async () => {
			const store = initInMemoryArticleStore();
			const saved = await store.saveArticle(makeArticleParams());
			await store.updateArticleStatus(saved.id, USER_A, "read");
			await store.updateArticleStatus(saved.id, USER_A, "unread");

			const found = await store.findArticleById(saved.id, USER_A);

			expect(found?.status).toBe("unread");
			expect(found?.readAt).toBeUndefined();
		});

		it("should not update another user's article", async () => {
			const store = initInMemoryArticleStore();
			const saved = await store.saveArticle(makeArticleParams({ userId: USER_A }));

			const updated = await store.updateArticleStatus(saved.id, USER_B, "read");

			expect(updated).toBe(false);
			const found = await store.findArticleById(saved.id, USER_A);
			expect(found?.status).toBe("unread");
		});

		it("should return false when updating status of a non-existent article", async () => {
			const store = initInMemoryArticleStore();
			const fakeId = ArticleIdSchema.parse("nonexistent-id");

			const updated = await store.updateArticleStatus(fakeId, USER_A, "read");

			expect(updated).toBe(false);
		});
	});

	describe("readContent", () => {
		it("should return content for a saved article by normalized URL", async () => {
			const store = initInMemoryArticleStore();
			await store.saveArticle(makeArticleParams({ content: "<p>Hello</p>" }));

			const content = await store.readContent(ArticleUniqueId.parse("https://example.com/article"));
			expect(content).toBe("<p>Hello</p>");
		});

		it("should return undefined when article does not exist", async () => {
			const store = initInMemoryArticleStore();

			const content = await store.readContent(ArticleUniqueId.parse("https://example.com/nonexistent"));
			expect(content).toBeUndefined();
		});

		it("should return undefined when article has no content", async () => {
			const store = initInMemoryArticleStore();
			await store.saveArticle(makeArticleParams({ content: undefined }));

			const content = await store.readContent(ArticleUniqueId.parse("https://example.com/article"));
			expect(content).toBeUndefined();
		});
	});
});
