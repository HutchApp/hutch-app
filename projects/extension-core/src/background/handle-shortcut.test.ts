import { initInMemoryAuth } from "../providers/auth/in-memory-auth";
import { initInMemoryReadingList } from "../providers/reading-list/in-memory-reading-list";
import { initSaveCurrentTab } from "./save-current-tab";
import { initHandleShortcut } from "./handle-shortcut";

function createDeps(tabsResponse: Array<{ id?: number; url?: string; title?: string }> = []) {
	const auth = initInMemoryAuth();
	const readingList = initInMemoryReadingList();
	const saveCurrentTab = initSaveCurrentTab({ saveUrl: readingList.saveUrl });
	const iconUpdates: Array<{ tabId: number; url: string }> = [];

	const shortcut = initHandleShortcut({
		queryActiveTabs: async () => tabsResponse,
		whenLoggedIn: auth.whenLoggedIn,
		saveCurrentTab,
		updateIconForTab: async (tabId, url) => {
			iconUpdates.push({ tabId, url });
		},
	});

	return { auth, readingList, shortcut, iconUpdates };
}

describe("initHandleShortcut", () => {
	it("should return open-login when not logged in", async () => {
		const { shortcut } = createDeps([
			{ id: 1, url: "https://example.com/article", title: "Article" },
		]);

		const result = await shortcut.onShortcutPressed();

		expect(result).toEqual({
			action: "open-login",
			url: "https://example.com/article",
			title: "Article",
			tabId: 1,
			tabUrl: "https://example.com/article",
		});
	});

	it("should return saved and update icon when logged in", async () => {
		const { auth, shortcut, iconUpdates } = createDeps([
			{ id: 42, url: "https://example.com/page", title: "Page" },
		]);
		await auth.login();

		const result = await shortcut.onShortcutPressed();

		expect(result).toEqual({
			action: "saved",
			tabId: 42,
			url: "https://example.com/page",
		});
		expect(iconUpdates).toEqual([{ tabId: 42, url: "https://example.com/page" }]);
	});

	it("should return null when no active tab", async () => {
		const { auth, shortcut } = createDeps([]);
		await auth.login();

		const result = await shortcut.onShortcutPressed();

		expect(result).toBeNull();
	});

	it("should return null when tab has no URL", async () => {
		const { auth, shortcut } = createDeps([{ id: 1 }]);
		await auth.login();

		const result = await shortcut.onShortcutPressed();

		expect(result).toBeNull();
	});

	it("should return null when tab has no ID", async () => {
		const { shortcut } = createDeps([{ url: "https://example.com" }]);

		const result = await shortcut.onShortcutPressed();

		expect(result).toBeNull();
	});

	it("should focus login window when one is already open", async () => {
		const { shortcut } = createDeps([
			{ id: 1, url: "https://example.com", title: "Example" },
		]);

		shortcut.onLoginWindowOpened(99, 1, "https://example.com");

		const result = await shortcut.onShortcutPressed();

		expect(result).toEqual({
			action: "focus-login-window",
			windowId: 99,
		});
	});

	it("should clear login window on window removed", async () => {
		const { auth, shortcut } = createDeps([
			{ id: 1, url: "https://example.com", title: "Example" },
		]);
		await auth.login();

		shortcut.onLoginWindowOpened(99, 1, "https://example.com");
		shortcut.onWindowRemoved(99);

		const result = await shortcut.onShortcutPressed();

		expect(result).toEqual({
			action: "saved",
			tabId: 1,
			url: "https://example.com",
		});
	});

	it("should not clear login window for unrelated window removal", async () => {
		const { shortcut } = createDeps([
			{ id: 1, url: "https://example.com", title: "Example" },
		]);

		shortcut.onLoginWindowOpened(99, 1, "https://example.com");
		shortcut.onWindowRemoved(50);

		const result = await shortcut.onShortcutPressed();

		expect(result).toEqual({
			action: "focus-login-window",
			windowId: 99,
		});
	});

	it("should use URL as title when tab has no title", async () => {
		const { shortcut } = createDeps([
			{ id: 1, url: "https://example.com/no-title" },
		]);

		const result = await shortcut.onShortcutPressed();

		expect(result).toEqual({
			action: "open-login",
			url: "https://example.com/no-title",
			title: "https://example.com/no-title",
			tabId: 1,
			tabUrl: "https://example.com/no-title",
		});
	});

	it("should return null when save fails due to already-saved", async () => {
		const { auth, readingList, shortcut } = createDeps([
			{ id: 1, url: "https://example.com/saved", title: "Saved" },
		]);
		await auth.login();
		await readingList.saveUrl({ url: "https://example.com/saved", title: "Saved" });

		const result = await shortcut.onShortcutPressed();

		expect(result).toBeNull();
	});
});
