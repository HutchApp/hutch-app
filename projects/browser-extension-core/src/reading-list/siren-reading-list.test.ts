import type { ReadingListItemId } from "../domain/reading-list-item.types";
import { initSirenReadingList, type SirenReadingListDeps } from "./siren-reading-list";

function createMockFetch(responses: Array<{ status: number; body?: unknown }>): SirenReadingListDeps["fetchFn"] {
	let callIndex = 0;
	return async () => {
		const { status, body } = responses[callIndex++];
		return {
			ok: status >= 200 && status < 300,
			status,
			json: async () => body,
		} as Response;
	};
}

function createDeps(fetchFn: SirenReadingListDeps["fetchFn"]): SirenReadingListDeps {
	return {
		serverUrl: "http://localhost:3000",
		getAccessToken: async () => "test-token",
		fetchFn,
	};
}

describe("initSirenReadingList", () => {
	describe("saveUrl", () => {
		it("should POST to /queue and return the saved item", async () => {
			const savedAt = "2026-01-15T10:00:00.000Z";
			const fetchFn = createMockFetch([{
				status: 201,
				body: {
					class: ["article"],
					properties: {
						id: "article-1",
						url: "https://example.com/article",
						title: "Article from example.com",
						savedAt,
					},
				},
			}]);
			const list = initSirenReadingList(createDeps(fetchFn));

			const result = await list.saveUrl({ url: "https://example.com/article", title: "Ignored" });

			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.item.url).toBe("https://example.com/article");
			expect(result.item.title).toBe("Article from example.com");
			expect(result.item.id).toBe("article-1");
			expect(result.item.savedAt).toEqual(new Date(savedAt));
		});

		it("should throw when server returns an error", async () => {
			const fetchFn = createMockFetch([{ status: 422 }]);
			const list = initSirenReadingList(createDeps(fetchFn));

			await expect(
				list.saveUrl({ url: "bad-url", title: "Test" }),
			).rejects.toThrow("Save failed: 422");
		});
	});

	describe("removeUrl", () => {
		it("should return ok when server responds with 204", async () => {
			const fetchFn = createMockFetch([{ status: 204 }]);
			const list = initSirenReadingList(createDeps(fetchFn));

			const result = await list.removeUrl("article-1" as ReadingListItemId);

			expect(result).toEqual({ ok: true });
		});

		it("should return not-found when server responds with non-204", async () => {
			const fetchFn = createMockFetch([{ status: 404 }]);
			const list = initSirenReadingList(createDeps(fetchFn));

			const result = await list.removeUrl("nonexistent" as ReadingListItemId);

			expect(result).toEqual({ ok: false, reason: "not-found" });
		});
	});

	describe("findByUrl", () => {
		it("should return the item when server returns a matching entity", async () => {
			const fetchFn = createMockFetch([{
				status: 200,
				body: {
					entities: [{
						properties: {
							id: "article-1",
							url: "https://example.com/article",
							title: "Found Article",
							savedAt: "2026-01-15T10:00:00.000Z",
						},
					}],
				},
			}]);
			const list = initSirenReadingList(createDeps(fetchFn));

			const found = await list.findByUrl("https://example.com/article");

			expect(found?.url).toBe("https://example.com/article");
			expect(found?.title).toBe("Found Article");
		});

		it("should return null when no entities match", async () => {
			const fetchFn = createMockFetch([{
				status: 200,
				body: { entities: [] },
			}]);
			const list = initSirenReadingList(createDeps(fetchFn));

			const found = await list.findByUrl("https://example.com/missing");

			expect(found).toBeNull();
		});

		it("should return null when server returns an error", async () => {
			const fetchFn = createMockFetch([{ status: 401 }]);
			const list = initSirenReadingList(createDeps(fetchFn));

			const found = await list.findByUrl("https://example.com/article");

			expect(found).toBeNull();
		});
	});

	describe("getAllItems", () => {
		it("should return all items from the collection", async () => {
			const fetchFn = createMockFetch([{
				status: 200,
				body: {
					entities: [
						{ properties: { id: "1", url: "https://example.com/a", title: "A", savedAt: "2026-01-15T10:00:00.000Z" } },
						{ properties: { id: "2", url: "https://example.com/b", title: "B", savedAt: "2026-01-15T11:00:00.000Z" } },
					],
				},
			}]);
			const list = initSirenReadingList(createDeps(fetchFn));

			const items = await list.getAllItems();

			expect(items.map(i => i.url)).toEqual(["https://example.com/a", "https://example.com/b"]);
		});

		it("should return empty array when collection is empty", async () => {
			const fetchFn = createMockFetch([{
				status: 200,
				body: { entities: [] },
			}]);
			const list = initSirenReadingList(createDeps(fetchFn));

			const items = await list.getAllItems();

			expect(items).toEqual([]);
		});

		it("should throw when server returns an error", async () => {
			const fetchFn = createMockFetch([{ status: 500 }]);
			const list = initSirenReadingList(createDeps(fetchFn));

			await expect(list.getAllItems()).rejects.toThrow("Fetch failed: 500");
		});
	});
});
