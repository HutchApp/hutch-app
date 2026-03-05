import { initInMemoryAuth } from "../providers/auth/in-memory-auth";
import { initInMemoryReadingList } from "../providers/reading-list/in-memory-reading-list";
import { initSaveCurrentTab } from "./save-current-tab";
import { initHandleShortcutCommand } from "./handle-shortcut-command";

describe("initHandleShortcutCommand", () => {
	it("should save when logged in and tab has URL", async () => {
		const auth = initInMemoryAuth();
		const readingList = initInMemoryReadingList();
		const saveCurrentTab = initSaveCurrentTab({ saveUrl: readingList.saveUrl });
		await auth.login({ email: "user@example.com", password: "password123" });

		const handleShortcut = initHandleShortcutCommand({
			queryActiveTabs: async () => [
				{ url: "https://example.com/article", title: "Example Article" },
			],
			whenLoggedIn: auth.whenLoggedIn,
			saveCurrentTab,
			hasLoginWindow: () => false,
		});

		const result = await handleShortcut();

		expect(result).toEqual({
			action: "saved",
			item: expect.objectContaining({
				url: "https://example.com/article",
			}),
		});
	});

	it("should return not-logged-in with URL info when not authenticated", async () => {
		const auth = initInMemoryAuth();
		const readingList = initInMemoryReadingList();
		const saveCurrentTab = initSaveCurrentTab({ saveUrl: readingList.saveUrl });

		const handleShortcut = initHandleShortcutCommand({
			queryActiveTabs: async () => [
				{ url: "https://example.com/article", title: "Example Article" },
			],
			whenLoggedIn: auth.whenLoggedIn,
			saveCurrentTab,
			hasLoginWindow: () => false,
		});

		const result = await handleShortcut();

		expect(result).toEqual({
			action: "not-logged-in",
			url: "https://example.com/article",
			title: "Example Article",
		});
	});

	it("should return null when no active tab exists", async () => {
		const auth = initInMemoryAuth();
		const readingList = initInMemoryReadingList();
		const saveCurrentTab = initSaveCurrentTab({ saveUrl: readingList.saveUrl });
		await auth.login({ email: "user@example.com", password: "password123" });

		const handleShortcut = initHandleShortcutCommand({
			queryActiveTabs: async () => [],
			whenLoggedIn: auth.whenLoggedIn,
			saveCurrentTab,
			hasLoginWindow: () => false,
		});

		const result = await handleShortcut();

		expect(result).toBeNull();
	});

	it("should return null when tab has no URL", async () => {
		const auth = initInMemoryAuth();
		const readingList = initInMemoryReadingList();
		const saveCurrentTab = initSaveCurrentTab({ saveUrl: readingList.saveUrl });
		await auth.login({ email: "user@example.com", password: "password123" });

		const handleShortcut = initHandleShortcutCommand({
			queryActiveTabs: async () => [{}],
			whenLoggedIn: auth.whenLoggedIn,
			saveCurrentTab,
			hasLoginWindow: () => false,
		});

		const result = await handleShortcut();

		expect(result).toBeNull();
	});

	it("should return login-window-focused when login window is already open", async () => {
		const auth = initInMemoryAuth();
		const readingList = initInMemoryReadingList();
		const saveCurrentTab = initSaveCurrentTab({ saveUrl: readingList.saveUrl });
		await auth.login({ email: "user@example.com", password: "password123" });

		const handleShortcut = initHandleShortcutCommand({
			queryActiveTabs: async () => [
				{ url: "https://example.com/article", title: "Example" },
			],
			whenLoggedIn: auth.whenLoggedIn,
			saveCurrentTab,
			hasLoginWindow: () => true,
		});

		const result = await handleShortcut();

		expect(result).toEqual({ action: "login-window-focused" });
	});

	it("should use URL as title when tab has no title", async () => {
		const auth = initInMemoryAuth();
		const readingList = initInMemoryReadingList();
		const saveCurrentTab = initSaveCurrentTab({ saveUrl: readingList.saveUrl });
		await auth.login({ email: "user@example.com", password: "password123" });

		const handleShortcut = initHandleShortcutCommand({
			queryActiveTabs: async () => [{ url: "https://example.com/no-title" }],
			whenLoggedIn: auth.whenLoggedIn,
			saveCurrentTab,
			hasLoginWindow: () => false,
		});

		const result = await handleShortcut();

		expect(result).toEqual({
			action: "saved",
			item: expect.objectContaining({
				url: "https://example.com/no-title",
				title: "https://example.com/no-title",
			}),
		});
	});

	it("should return not-logged-in with URL as title when tab has no title", async () => {
		const auth = initInMemoryAuth();
		const readingList = initInMemoryReadingList();
		const saveCurrentTab = initSaveCurrentTab({ saveUrl: readingList.saveUrl });

		const handleShortcut = initHandleShortcutCommand({
			queryActiveTabs: async () => [{ url: "https://example.com/no-title" }],
			whenLoggedIn: auth.whenLoggedIn,
			saveCurrentTab,
			hasLoginWindow: () => false,
		});

		const result = await handleShortcut();

		expect(result).toEqual({
			action: "not-logged-in",
			url: "https://example.com/no-title",
			title: "https://example.com/no-title",
		});
	});

	it("should return null when save fails due to already-saved", async () => {
		const auth = initInMemoryAuth();
		const readingList = initInMemoryReadingList();
		const saveCurrentTab = initSaveCurrentTab({ saveUrl: readingList.saveUrl });
		await auth.login({ email: "user@example.com", password: "password123" });
		await readingList.saveUrl({ url: "https://example.com/saved", title: "Saved" });

		const handleShortcut = initHandleShortcutCommand({
			queryActiveTabs: async () => [
				{ url: "https://example.com/saved", title: "Saved" },
			],
			whenLoggedIn: auth.whenLoggedIn,
			saveCurrentTab,
			hasLoginWindow: () => false,
		});

		const result = await handleShortcut();

		expect(result).toBeNull();
	});
});
