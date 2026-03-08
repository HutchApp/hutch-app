import { initInMemoryReadingList } from "./reading-list/in-memory-reading-list";
import {
	MENU_ITEM_SAVE_LINK,
	MENU_ITEM_SAVE_PAGE,
	initSaveFromContextMenu,
} from "./save-from-context-menu";

describe("initSaveFromContextMenu", () => {
	describe("save page", () => {
		it("should save the page URL and title from the tab", async () => {
			const list = initInMemoryReadingList();
			const save = initSaveFromContextMenu({ saveUrl: list.saveUrl });

			const result = await save(
				{ menuItemId: MENU_ITEM_SAVE_PAGE, pageUrl: "https://example.com/article" },
				{ url: "https://example.com/article", title: "Example Article" },
			);

			expect(result).toEqual(
				expect.objectContaining({ ok: true, item: expect.objectContaining({ url: "https://example.com/article", title: "Example Article" }) }),
			);
		});

		it("should fall back to pageUrl when tab has no URL", async () => {
			const list = initInMemoryReadingList();
			const save = initSaveFromContextMenu({ saveUrl: list.saveUrl });

			const result = await save(
				{ menuItemId: MENU_ITEM_SAVE_PAGE, pageUrl: "https://example.com/page" },
				{ title: "Some Title" },
			);

			expect(result).toEqual(
				expect.objectContaining({ ok: true, item: expect.objectContaining({ url: "https://example.com/page" }) }),
			);
		});

		it("should use URL as title when tab has no title", async () => {
			const list = initInMemoryReadingList();
			const save = initSaveFromContextMenu({ saveUrl: list.saveUrl });

			const result = await save(
				{ menuItemId: MENU_ITEM_SAVE_PAGE, pageUrl: "https://example.com/no-title" },
			);

			expect(result).toEqual(
				expect.objectContaining({ ok: true, item: expect.objectContaining({ url: "https://example.com/no-title", title: "https://example.com/no-title" }) }),
			);
		});

		it("should return null when page has no URL", async () => {
			const list = initInMemoryReadingList();
			const save = initSaveFromContextMenu({ saveUrl: list.saveUrl });

			const result = await save(
				{ menuItemId: MENU_ITEM_SAVE_PAGE },
				{ title: "No URL Page" },
			);

			expect(result).toBeNull();
		});

		it("should return already-saved for a duplicate page URL", async () => {
			const list = initInMemoryReadingList();
			const save = initSaveFromContextMenu({ saveUrl: list.saveUrl });

			await save(
				{ menuItemId: MENU_ITEM_SAVE_PAGE, pageUrl: "https://example.com/dup" },
				{ url: "https://example.com/dup", title: "First" },
			);

			const result = await save(
				{ menuItemId: MENU_ITEM_SAVE_PAGE, pageUrl: "https://example.com/dup" },
				{ url: "https://example.com/dup", title: "Second" },
			);

			expect(result).toEqual({ ok: false, reason: "already-saved" });
		});
	});

	describe("save link", () => {
		it("should save the link URL using linkUrl as both url and title", async () => {
			const list = initInMemoryReadingList();
			const save = initSaveFromContextMenu({ saveUrl: list.saveUrl });

			const result = await save(
				{ menuItemId: MENU_ITEM_SAVE_LINK, linkUrl: "https://example.com/linked" },
				{ url: "https://example.com/page", title: "Page Title" },
			);

			expect(result).toEqual(
				expect.objectContaining({ ok: true, item: expect.objectContaining({ url: "https://example.com/linked", title: "https://example.com/linked" }) }),
			);
		});

		it("should return already-saved for a duplicate link URL", async () => {
			const list = initInMemoryReadingList();
			const save = initSaveFromContextMenu({ saveUrl: list.saveUrl });

			await save(
				{ menuItemId: MENU_ITEM_SAVE_LINK, linkUrl: "https://example.com/linked" },
			);

			const result = await save(
				{ menuItemId: MENU_ITEM_SAVE_LINK, linkUrl: "https://example.com/linked" },
			);

			expect(result).toEqual({ ok: false, reason: "already-saved" });
		});

		it("should return null when link menu clicked without linkUrl", async () => {
			const list = initInMemoryReadingList();
			const save = initSaveFromContextMenu({ saveUrl: list.saveUrl });

			const result = await save(
				{ menuItemId: MENU_ITEM_SAVE_LINK },
			);

			expect(result).toBeNull();
		});
	});

	describe("unknown menu item", () => {
		it("should return null for an unrecognized menu item ID", async () => {
			const list = initInMemoryReadingList();
			const save = initSaveFromContextMenu({ saveUrl: list.saveUrl });

			const result = await save(
				{ menuItemId: "unknown-item", pageUrl: "https://example.com" },
				{ url: "https://example.com", title: "Example" },
			);

			expect(result).toBeNull();
		});
	});
});
