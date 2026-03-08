import { initInMemoryAuth } from "../providers/auth/in-memory-auth";
import { initInMemoryReadingList } from "../providers/reading-list/in-memory-reading-list";
import { initSaveCurrentTab } from "../background/save-current-tab";
import { initHandlePopupMessage } from "../background/handle-popup-message";
import type { SendPopupMessage } from "../background/messages.types";
import { initPopupFlow } from "./popup-flow";

function createSetup(activeTab: { url: string; title: string } | null = null) {
	const auth = initInMemoryAuth();
	const readingList = initInMemoryReadingList();
	const saveCurrentTab = initSaveCurrentTab({ saveUrl: readingList.saveUrl });

	const handlePopupMessage = initHandlePopupMessage({
		login: auth.login,
		logout: auth.logout,
		whenLoggedIn: auth.whenLoggedIn,
		saveCurrentTab,
		removeUrl: readingList.removeUrl,
		findByUrl: readingList.findByUrl,
		getAllItems: readingList.getAllItems,
		updateActiveTabIcon: async () => {},
	});

	const flow = initPopupFlow({
		sendMessage: handlePopupMessage as SendPopupMessage,
		getActiveTab: async () => activeTab,
	});

	return { auth, readingList, flow };
}

describe("initPopupFlow", () => {
	describe("start", () => {
		it("should show login view when not logged in and on a tab", async () => {
			const { flow } = createSetup({ url: "https://example.com", title: "Example" });

			const view = await flow.start();

			expect(view).toEqual({ view: "login" });
		});

		it("should save current tab and show saved view when logged in", async () => {
			const { auth, flow } = createSetup({ url: "https://example.com", title: "Example" });
			await auth.login();

			const view = await flow.start();

			expect(view.view).toBe("saved");
			if (view.view === "saved") {
				expect(view.itemId).toBeDefined();
			}
		});

		it("should show list view when no active tab", async () => {
			const { auth, flow } = createSetup(null);
			await auth.login();

			const view = await flow.start();

			expect(view.view).toBe("list");
		});

		it("should show list view when URL is already saved", async () => {
			const { auth, readingList, flow } = createSetup({
				url: "https://example.com",
				title: "Example",
			});
			await auth.login();
			await readingList.saveUrl({ url: "https://example.com", title: "Example" });

			const view = await flow.start();

			expect(view.view).toBe("list");
		});
	});

	describe("login", () => {
		it("should login and save tab, showing saved view", async () => {
			const { flow } = createSetup({ url: "https://example.com", title: "Example" });

			const view = await flow.login();

			expect(view.view).toBe("saved");
		});

		it("should show list view after login when no active tab", async () => {
			const flow = createSetup(null).flow;

			const view = await flow.login();

			expect(view.view).toBe("list");
		});
	});

	describe("undo", () => {
		it("should undo the save and show list view", async () => {
			const { auth, flow } = createSetup({ url: "https://example.com", title: "Example" });
			await auth.login();

			await flow.start();
			const view = await flow.undo();

			expect(view.view).toBe("list");
			if (view.view === "list") {
				expect(view.items).toEqual([]);
			}
		});
	});

	describe("filter", () => {
		it("should filter items by query", async () => {
			const { auth, readingList, flow } = createSetup(null);
			await auth.login();
			await readingList.saveUrl({ url: "https://github.com/repo", title: "GitHub" });
			await readingList.saveUrl({ url: "https://example.com", title: "Example" });

			await flow.start();
			const view = flow.filter("github");

			expect(view.view).toBe("list");
			if (view.view === "list") {
				expect(view.items).toHaveLength(1);
				expect(view.items[0].url).toBe("https://github.com/repo");
			}
		});
	});

	describe("goToPage", () => {
		it("should navigate to specified page", async () => {
			const { auth, readingList, flow } = createSetup(null);
			await auth.login();
			for (let i = 0; i < 15; i++) {
				await readingList.saveUrl({
					url: `https://example.com/${i}`,
					title: `Item ${i}`,
				});
			}

			await flow.start();
			const view = flow.goToPage(2);

			expect(view.view).toBe("list");
			if (view.view === "list") {
				expect(view.page).toBe(2);
				expect(view.items).toHaveLength(5);
			}
		});
	});

	describe("removeItem", () => {
		it("should remove item and refresh list", async () => {
			const { auth, readingList, flow } = createSetup(null);
			await auth.login();
			const saveResult = await readingList.saveUrl({
				url: "https://example.com",
				title: "Example",
			});
			if (!saveResult.ok) throw new Error("Save failed");

			await flow.start();
			const view = await flow.removeItem(saveResult.item.id);

			expect(view.view).toBe("list");
			if (view.view === "list") {
				expect(view.items).toEqual([]);
			}
		});
	});

	describe("logout", () => {
		it("should show login view after logout", async () => {
			const { auth, flow } = createSetup(null);
			await auth.login();

			const view = await flow.logout();

			expect(view).toEqual({ view: "login" });
		});
	});

	describe("reload", () => {
		it("should reload items from background", async () => {
			const { auth, readingList, flow } = createSetup(null);
			await auth.login();
			await readingList.saveUrl({ url: "https://example.com", title: "Example" });

			const view = await flow.reload();

			expect(view.view).toBe("list");
			if (view.view === "list") {
				expect(view.items).toHaveLength(1);
			}
		});
	});
});
