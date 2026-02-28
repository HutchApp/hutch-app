import type { ReadingListItemId } from "../../domain/reading-list-item.types";
import { initInMemoryReadingList } from "./in-memory-reading-list";

describe("initInMemoryReadingList", () => {
	describe("saveUrl + findByUrl", () => {
		it("should save and retrieve by URL", async () => {
			const list = initInMemoryReadingList();
			const result = await list.saveUrl({
				url: "https://example.com/article",
				title: "Example Article",
			});

			expect(result.ok).toBe(true);
			if (!result.ok) return;

			const found = await list.findByUrl("https://example.com/article");
			expect(found?.url).toBe("https://example.com/article");
			expect(found?.title).toBe("Example Article");
			expect(found?.id).toBe(result.item.id);
		});

		it("should return null for URL not in list", async () => {
			const list = initInMemoryReadingList();

			const found = await list.findByUrl("https://example.com/missing");

			expect(found).toBeNull();
		});
	});

	describe("saveUrl duplicate rejection", () => {
		it("should reject saving the same URL twice", async () => {
			const list = initInMemoryReadingList();
			await list.saveUrl({ url: "https://example.com/article", title: "First Save" });

			const result = await list.saveUrl({
				url: "https://example.com/article",
				title: "Second Save",
			});

			expect(result).toEqual({ ok: false, reason: "already-saved" });
		});
	});

	describe("removeUrl", () => {
		it("should remove an item and verify it is gone", async () => {
			const list = initInMemoryReadingList();
			const saveResult = await list.saveUrl({
				url: "https://example.com/article",
				title: "Example",
			});
			if (!saveResult.ok) throw new Error("Save failed");

			const removeResult = await list.removeUrl(saveResult.item.id);

			expect(removeResult).toEqual({ ok: true });
			expect(
				await list.findByUrl("https://example.com/article"),
			).toBeNull();
		});

		it("should return not-found for unknown ID", async () => {
			const list = initInMemoryReadingList();

			const result = await list.removeUrl(
				"nonexistent-id" as ReadingListItemId,
			);

			expect(result).toEqual({ ok: false, reason: "not-found" });
		});
	});

	describe("getAllItems", () => {
		it("should return empty array when no items saved", async () => {
			const list = initInMemoryReadingList();

			const items = await list.getAllItems();

			expect(items).toEqual([]);
		});

		it("should return all saved items", async () => {
			const list = initInMemoryReadingList();
			await list.saveUrl({ url: "https://example.com/a", title: "Article A" });
			await list.saveUrl({ url: "https://example.com/b", title: "Article B" });

			const items = await list.getAllItems();

			expect(items.length).toBe(2);
			const urls = items.map((item) => item.url);
			expect(urls).toContain("https://example.com/a");
			expect(urls).toContain("https://example.com/b");
		});
	});
});
