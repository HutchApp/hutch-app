import { initInMemoryAuth } from "./auth/in-memory-auth";
import { initInMemoryReadingList } from "./reading-list/in-memory-reading-list";
import { initSaveCurrentTab } from "./save-current-tab";
import { initHandleSaveCommand } from "./handle-save-command";

describe("initHandleSaveCommand", () => {
	it("should save the active tab URL and title", async () => {
		const auth = initInMemoryAuth();
		const readingList = initInMemoryReadingList();
		const saveCurrentTab = initSaveCurrentTab({ saveUrl: readingList.saveUrl });
		await auth.login();

		const handleSaveCommand = initHandleSaveCommand({
			queryActiveTabs: async () => [
				{ url: "https://example.com/article", title: "Example Article" },
			],
			whenLoggedIn: auth.whenLoggedIn,
			saveCurrentTab,
		});

		const result = await handleSaveCommand();

		expect(result).toEqual({
			ok: true,
			item: expect.objectContaining({
				url: "https://example.com/article",
				title: "Example Article",
			}),
		});
	});

	it("should use URL as title when tab has no title", async () => {
		const auth = initInMemoryAuth();
		const readingList = initInMemoryReadingList();
		const saveCurrentTab = initSaveCurrentTab({ saveUrl: readingList.saveUrl });
		await auth.login();

		const handleSaveCommand = initHandleSaveCommand({
			queryActiveTabs: async () => [
				{ url: "https://example.com/no-title" },
			],
			whenLoggedIn: auth.whenLoggedIn,
			saveCurrentTab,
		});

		const result = await handleSaveCommand();

		expect(result).toEqual({
			ok: true,
			item: expect.objectContaining({
				url: "https://example.com/no-title",
				title: "https://example.com/no-title",
			}),
		});
	});

	it("should return null when no active tab exists", async () => {
		const auth = initInMemoryAuth();
		const readingList = initInMemoryReadingList();
		const saveCurrentTab = initSaveCurrentTab({ saveUrl: readingList.saveUrl });
		await auth.login();

		const handleSaveCommand = initHandleSaveCommand({
			queryActiveTabs: async () => [],
			whenLoggedIn: auth.whenLoggedIn,
			saveCurrentTab,
		});

		const result = await handleSaveCommand();

		expect(result).toBeNull();
	});

	it("should return null when active tab has no URL", async () => {
		const auth = initInMemoryAuth();
		const readingList = initInMemoryReadingList();
		const saveCurrentTab = initSaveCurrentTab({ saveUrl: readingList.saveUrl });
		await auth.login();

		const handleSaveCommand = initHandleSaveCommand({
			queryActiveTabs: async () => [{}],
			whenLoggedIn: auth.whenLoggedIn,
			saveCurrentTab,
		});

		const result = await handleSaveCommand();

		expect(result).toBeNull();
	});

	it("should return null when not logged in", async () => {
		const auth = initInMemoryAuth();
		const readingList = initInMemoryReadingList();
		const saveCurrentTab = initSaveCurrentTab({ saveUrl: readingList.saveUrl });

		const handleSaveCommand = initHandleSaveCommand({
			queryActiveTabs: async () => [
				{ url: "https://example.com/article", title: "Example" },
			],
			whenLoggedIn: auth.whenLoggedIn,
			saveCurrentTab,
		});

		const result = await handleSaveCommand();

		expect(result).toBeNull();
	});

	it("should return already-saved when URL was previously saved", async () => {
		const auth = initInMemoryAuth();
		const readingList = initInMemoryReadingList();
		const saveCurrentTab = initSaveCurrentTab({ saveUrl: readingList.saveUrl });
		await auth.login();

		const handleSaveCommand = initHandleSaveCommand({
			queryActiveTabs: async () => [
				{ url: "https://example.com/duplicate", title: "Duplicate" },
			],
			whenLoggedIn: auth.whenLoggedIn,
			saveCurrentTab,
		});

		await handleSaveCommand();
		const result = await handleSaveCommand();

		expect(result).toEqual({ ok: false, reason: "already-saved" });
	});
});
