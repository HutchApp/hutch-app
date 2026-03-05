import { initInMemoryAuth } from "../providers/auth/in-memory-auth";
import { initInMemoryReadingList } from "../providers/reading-list/in-memory-reading-list";
import { initSaveCurrentTab } from "./save-current-tab";
import { initHandleToggleCommand } from "./handle-toggle-command";

describe("initHandleToggleCommand", () => {
	it("should save when URL is not in the reading list", async () => {
		const auth = initInMemoryAuth();
		const readingList = initInMemoryReadingList();
		const saveCurrentTab = initSaveCurrentTab({ saveUrl: readingList.saveUrl });
		await auth.login({ email: "user@example.com", password: "password123" });

		const handleToggle = initHandleToggleCommand({
			queryActiveTabs: async () => [
				{ url: "https://example.com/article", title: "Example Article" },
			],
			whenLoggedIn: auth.whenLoggedIn,
			saveCurrentTab,
			findByUrl: readingList.findByUrl,
			removeUrl: readingList.removeUrl,
		});

		const result = await handleToggle();

		expect(result).toEqual({
			action: "saved",
			item: expect.objectContaining({
				url: "https://example.com/article",
			}),
		});
	});

	it("should remove when URL is already in the reading list", async () => {
		const auth = initInMemoryAuth();
		const readingList = initInMemoryReadingList();
		const saveCurrentTab = initSaveCurrentTab({ saveUrl: readingList.saveUrl });
		await auth.login({ email: "user@example.com", password: "password123" });
		await readingList.saveUrl({ url: "https://example.com/saved", title: "Saved" });

		const handleToggle = initHandleToggleCommand({
			queryActiveTabs: async () => [
				{ url: "https://example.com/saved", title: "Saved" },
			],
			whenLoggedIn: auth.whenLoggedIn,
			saveCurrentTab,
			findByUrl: readingList.findByUrl,
			removeUrl: readingList.removeUrl,
		});

		const result = await handleToggle();

		expect(result).toEqual({ action: "removed" });
	});

	it("should return null when no active tab exists", async () => {
		const auth = initInMemoryAuth();
		const readingList = initInMemoryReadingList();
		const saveCurrentTab = initSaveCurrentTab({ saveUrl: readingList.saveUrl });
		await auth.login({ email: "user@example.com", password: "password123" });

		const handleToggle = initHandleToggleCommand({
			queryActiveTabs: async () => [],
			whenLoggedIn: auth.whenLoggedIn,
			saveCurrentTab,
			findByUrl: readingList.findByUrl,
			removeUrl: readingList.removeUrl,
		});

		const result = await handleToggle();

		expect(result).toBeNull();
	});

	it("should return not-logged-in when not logged in", async () => {
		const auth = initInMemoryAuth();
		const readingList = initInMemoryReadingList();
		const saveCurrentTab = initSaveCurrentTab({ saveUrl: readingList.saveUrl });

		const handleToggle = initHandleToggleCommand({
			queryActiveTabs: async () => [
				{ url: "https://example.com/article", title: "Example" },
			],
			whenLoggedIn: auth.whenLoggedIn,
			saveCurrentTab,
			findByUrl: readingList.findByUrl,
			removeUrl: readingList.removeUrl,
		});

		const result = await handleToggle();

		expect(result).toEqual({ action: "not-logged-in" });
	});

	it("should use URL as title when tab has no title", async () => {
		const auth = initInMemoryAuth();
		const readingList = initInMemoryReadingList();
		const saveCurrentTab = initSaveCurrentTab({ saveUrl: readingList.saveUrl });
		await auth.login({ email: "user@example.com", password: "password123" });

		const handleToggle = initHandleToggleCommand({
			queryActiveTabs: async () => [
				{ url: "https://example.com/no-title" },
			],
			whenLoggedIn: auth.whenLoggedIn,
			saveCurrentTab,
			findByUrl: readingList.findByUrl,
			removeUrl: readingList.removeUrl,
		});

		const result = await handleToggle();

		expect(result).toEqual({
			action: "saved",
			item: expect.objectContaining({
				url: "https://example.com/no-title",
				title: "https://example.com/no-title",
			}),
		});
	});

	it("should return null when logged out before remove", async () => {
		const auth = initInMemoryAuth();
		const readingList = initInMemoryReadingList();
		const saveCurrentTab = initSaveCurrentTab({ saveUrl: readingList.saveUrl });
		await auth.login({ email: "user@example.com", password: "password123" });
		await readingList.saveUrl({ url: "https://example.com/page", title: "Page" });

		let callCount = 0;
		const handleToggle = initHandleToggleCommand({
			queryActiveTabs: async () => [
				{ url: "https://example.com/page", title: "Page" },
			],
			whenLoggedIn: (fn) => {
				callCount++;
				if (callCount === 2) {
					return { ok: false as const, reason: "not-logged-in" as const };
				}
				return auth.whenLoggedIn(fn);
			},
			saveCurrentTab,
			findByUrl: readingList.findByUrl,
			removeUrl: readingList.removeUrl,
		});

		const result = await handleToggle();

		expect(result).toBeNull();
	});

	it("should allow saving again after removing", async () => {
		const auth = initInMemoryAuth();
		const readingList = initInMemoryReadingList();
		const saveCurrentTab = initSaveCurrentTab({ saveUrl: readingList.saveUrl });
		await auth.login({ email: "user@example.com", password: "password123" });
		await readingList.saveUrl({ url: "https://example.com/toggle", title: "Toggle" });

		const handleToggle = initHandleToggleCommand({
			queryActiveTabs: async () => [
				{ url: "https://example.com/toggle", title: "Toggle" },
			],
			whenLoggedIn: auth.whenLoggedIn,
			saveCurrentTab,
			findByUrl: readingList.findByUrl,
			removeUrl: readingList.removeUrl,
		});

		const removeResult = await handleToggle();
		expect(removeResult).toEqual({ action: "removed" });

		const saveResult = await handleToggle();
		expect(saveResult).toEqual({
			action: "saved",
			item: expect.objectContaining({
				url: "https://example.com/toggle",
			}),
		});
	});
});
