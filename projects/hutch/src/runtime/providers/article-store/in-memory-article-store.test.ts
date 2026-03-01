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

			const found = await store.findArticleById(saved.id);

			expect(found?.url).toBe("https://example.com/article");
			expect(found?.status).toBe("unread");
		});
	});

	describe("findArticlesByUser", () => {
		it("should return only articles belonging to the user", async () => {
			const store = initInMemoryArticleStore();
			await store.saveArticle(makeArticleParams({ userId: USER_A }));
			await store.saveArticle(makeArticleParams({ userId: USER_B }));

			const result = await store.findArticlesByUser({ userId: USER_A });

			expect(result.articles.length).toBe(1);
			expect(result.total).toBe(1);
		});

		it("should filter by status", async () => {
			const store = initInMemoryArticleStore();
			const a1 = await store.saveArticle(makeArticleParams());
			await store.saveArticle(makeArticleParams());
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
			// Ensure different timestamp
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
			// Ensure different timestamp
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
		it("should delete own article", async () => {
			const store = initInMemoryArticleStore();
			const saved = await store.saveArticle(makeArticleParams());

			const deleted = await store.deleteArticle(saved.id, USER_A);

			expect(deleted).toBe(true);
			expect(await store.findArticleById(saved.id)).toBeNull();
		});

		it("should not delete another user's article", async () => {
			const store = initInMemoryArticleStore();
			const saved = await store.saveArticle(makeArticleParams({ userId: USER_A }));

			const deleted = await store.deleteArticle(saved.id, USER_B);

			expect(deleted).toBe(false);
			expect((await store.findArticleById(saved.id))?.url).toBe("https://example.com/article");
		});
	});

	describe("updateArticleStatus", () => {
		it("should update status and set readAt for read", async () => {
			const store = initInMemoryArticleStore();
			const saved = await store.saveArticle(makeArticleParams());

			await store.updateArticleStatus(saved.id, USER_A, "read");
			const found = await store.findArticleById(saved.id);

			expect(found?.status).toBe("read");
			expect(found?.readAt).toBeInstanceOf(Date);
		});

		it("should clear readAt when marking unread", async () => {
			const store = initInMemoryArticleStore();
			const saved = await store.saveArticle(makeArticleParams());
			await store.updateArticleStatus(saved.id, USER_A, "read");
			await store.updateArticleStatus(saved.id, USER_A, "unread");

			const found = await store.findArticleById(saved.id);

			expect(found?.status).toBe("unread");
			expect(found?.readAt).toBeUndefined();
		});
	});

});
