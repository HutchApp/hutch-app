import { initInMemoryAuth } from "../providers/auth/in-memory-auth";
import { initInMemoryReadingList } from "../providers/reading-list/in-memory-reading-list";
import { initSaveCurrentTab } from "./save-current-tab";
import { initHandlePopupMessage } from "./handle-popup-message";

function createDeps() {
	const auth = initInMemoryAuth();
	const readingList = initInMemoryReadingList();
	const saveCurrentTab = initSaveCurrentTab({ saveUrl: readingList.saveUrl });
	const iconUpdates: string[] = [];

	const handlePopupMessage = initHandlePopupMessage({
		login: auth.login,
		logout: auth.logout,
		whenLoggedIn: auth.whenLoggedIn,
		saveCurrentTab,
		removeUrl: readingList.removeUrl,
		findByUrl: readingList.findByUrl,
		getAllItems: readingList.getAllItems,
		updateActiveTabIcon: async () => {
			iconUpdates.push("updated");
		},
	});

	return { auth, readingList, handlePopupMessage, iconUpdates };
}

describe("initHandlePopupMessage", () => {
	describe("login", () => {
		it("should return ok and update icon on successful login", async () => {
			const { handlePopupMessage, iconUpdates } = createDeps();

			const result = await handlePopupMessage({
				type: "login",
			});

			expect(result).toEqual({ ok: true });
			await new Promise((r) => setTimeout(r, 0));
			expect(iconUpdates).toEqual(["updated"]);
		});
	});

	describe("logout", () => {
		it("should return ok and update icon", async () => {
			const { auth, handlePopupMessage, iconUpdates } = createDeps();
			await auth.login();

			const result = await handlePopupMessage({ type: "logout" });

			expect(result).toEqual({ ok: true });
			await new Promise((r) => setTimeout(r, 0));
			expect(iconUpdates).toEqual(["updated"]);
		});
	});

	describe("save-current-tab", () => {
		it("should save and return guarded result when logged in", async () => {
			const { auth, handlePopupMessage } = createDeps();
			await auth.login();

			const result = await handlePopupMessage({
				type: "save-current-tab",
				url: "https://example.com/page",
				title: "Example Page",
			});

			expect(result).toEqual({
				ok: true,
				value: {
					ok: true,
					item: expect.objectContaining({
						url: "https://example.com/page",
						title: "Example Page",
					}),
				},
			});
		});

		it("should return not-logged-in when not authenticated", async () => {
			const { handlePopupMessage } = createDeps();

			const result = await handlePopupMessage({
				type: "save-current-tab",
				url: "https://example.com",
				title: "Example",
			});

			expect(result).toEqual({ ok: false, reason: "not-logged-in" });
		});
	});

	describe("remove-item", () => {
		it("should remove item and update icon", async () => {
			const { auth, readingList, handlePopupMessage, iconUpdates } = createDeps();
			await auth.login();
			const saveResult = await readingList.saveUrl({
				url: "https://example.com",
				title: "Example",
			});
			if (!saveResult.ok) throw new Error("Save failed");

			const result = await handlePopupMessage({
				type: "remove-item",
				id: saveResult.item.id,
			});

			expect(result).toEqual({ ok: true, value: { ok: true } });
			await new Promise((r) => setTimeout(r, 0));
			expect(iconUpdates.length).toBeGreaterThan(0);
		});
	});

	describe("check-url", () => {
		it("should return null when URL is not saved", async () => {
			const { auth, handlePopupMessage } = createDeps();
			await auth.login();

			const result = await handlePopupMessage({
				type: "check-url",
				url: "https://example.com/unsaved",
			});

			expect(result).toEqual({ ok: true, value: null });
		});

		it("should return the item when URL is saved", async () => {
			const { auth, readingList, handlePopupMessage } = createDeps();
			await auth.login();
			await readingList.saveUrl({ url: "https://example.com", title: "Example" });

			const result = await handlePopupMessage({
				type: "check-url",
				url: "https://example.com",
			});

			expect(result).toEqual({
				ok: true,
				value: expect.objectContaining({ url: "https://example.com" }),
			});
		});
	});

	describe("get-all-items", () => {
		it("should return all items when logged in", async () => {
			const { auth, readingList, handlePopupMessage } = createDeps();
			await auth.login();
			await readingList.saveUrl({ url: "https://a.com", title: "A" });
			await readingList.saveUrl({ url: "https://b.com", title: "B" });

			const result = await handlePopupMessage({ type: "get-all-items" });

			expect(result).toEqual({
				ok: true,
				value: expect.arrayContaining([
					expect.objectContaining({ url: "https://a.com" }),
					expect.objectContaining({ url: "https://b.com" }),
				]),
			});
		});

		it("should return not-logged-in when not authenticated", async () => {
			const { handlePopupMessage } = createDeps();

			const result = await handlePopupMessage({ type: "get-all-items" });

			expect(result).toEqual({ ok: false, reason: "not-logged-in" });
		});
	});
});
