import type { Login, Logout, WhenLoggedIn } from "../providers/auth/auth.types";
import type {
	FindByUrl,
	GetAllItems,
	RemoveUrl,
	SaveUrl,
} from "../providers/reading-list/reading-list.types";
import type { PopupMessage } from "./messages.types";
import { initSaveCurrentTab } from "./save-current-tab";
import { initIconStatus } from "./icon-status";
import { createBrowserSetIcon } from "./tinted-icon.browser";
import {
	MENU_ITEM_SAVE_LINK,
	MENU_ITEM_SAVE_PAGE,
	initSaveFromContextMenu,
} from "./save-from-context-menu";
import { initHandleShortcutCommand } from "./handle-shortcut-command";

interface BackgroundDeps {
	auth: {
		login: Login;
		logout: Logout;
		whenLoggedIn: WhenLoggedIn;
	};
	readingList: {
		saveUrl: SaveUrl;
		removeUrl: RemoveUrl;
		findByUrl: FindByUrl;
		getAllItems: GetAllItems;
	};
}

export function initBackground(deps: BackgroundDeps): void {
	const { auth, readingList } = deps;

	const saveCurrentTab = initSaveCurrentTab({ saveUrl: readingList.saveUrl });
	const { updateIconForTab } = initIconStatus({
		findByUrl: readingList.findByUrl,
		whenLoggedIn: auth.whenLoggedIn,
		setIcon: createBrowserSetIcon(),
	});
	const saveFromContextMenu = initSaveFromContextMenu({
		saveUrl: readingList.saveUrl,
	});

	let loginWindow: { id: number; tabId: number; tabUrl: string } | null =
		null;

	const handleShortcut = initHandleShortcutCommand({
		queryActiveTabs: () =>
			browser.tabs.query({ active: true, currentWindow: true }),
		whenLoggedIn: auth.whenLoggedIn,
		saveCurrentTab,
		hasLoginWindow: () => loginWindow != null,
	});

	browser.menus.create({
		id: MENU_ITEM_SAVE_PAGE,
		title: "Save Page to Hutch",
		contexts: ["page"],
	});

	browser.menus.create({
		id: MENU_ITEM_SAVE_LINK,
		title: "Save Link to Hutch",
		contexts: ["link"],
	});

	browser.menus.onClicked.addListener((info, tab) => {
		const guarded = auth.whenLoggedIn(() => saveFromContextMenu(info, tab));
		if (guarded.ok) {
			guarded.value.then(async () => {
				if (tab?.id && tab.url) {
					await updateIconForTab(tab.id, tab.url);
				}
			});
		}
	});

	async function updateActiveTabIcon() {
		const tabs = await browser.tabs.query({
			active: true,
			currentWindow: true,
		});
		const tab = tabs[0];
		if (tab?.id != null && tab.url) {
			await updateIconForTab(tab.id, tab.url);
		}
	}

	browser.windows.onRemoved.addListener((windowId) => {
		if (loginWindow && windowId === loginWindow.id) {
			updateIconForTab(loginWindow.tabId, loginWindow.tabUrl).catch(
				() => {},
			);
			loginWindow = null;
		}
	});

	browser.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
		if ((raw as { type: string }).type === "shortcut-pressed") {
			(async () => {
				const tabs = await browser.tabs.query({
					active: true,
					currentWindow: true,
				});
				const tab = tabs[0];
				const result = await handleShortcut();

				if (result?.action === "login-window-focused" && loginWindow) {
					await browser.windows.update(loginWindow.id, {
						focused: true,
					});
					return;
				}

				if (result?.action === "not-logged-in") {
					const params = `?url=${encodeURIComponent(result.url)}&title=${encodeURIComponent(result.title)}`;
					const win = await browser.windows.create({
						url: browser.runtime.getURL(
							`popup/popup.template.html${params}`,
						),
						type: "popup",
						width: 380,
						height: 520,
					});
					if (win.id != null && tab?.id != null) {
						loginWindow = {
							id: win.id,
							tabId: tab.id,
							tabUrl: result.url,
						};
					}
					return;
				}

				if (result?.action === "saved" && tab?.id != null && tab.url) {
					await updateIconForTab(tab.id, tab.url);
				}
			})().catch(console.error);
			return;
		}

		const message = raw as PopupMessage;

		const handle = async () => {
			switch (message.type) {
				case "login": {
					const result = await auth.login({
						email: message.email,
						password: message.password,
					});
					if (result.ok) updateActiveTabIcon().catch(() => {});
					return result;
				}
				case "logout": {
					await auth.logout();
					updateActiveTabIcon().catch(() => {});
					return { ok: true };
				}
				case "save-current-tab": {
					const guarded = auth.whenLoggedIn(() =>
						saveCurrentTab({
							url: message.url,
							title: message.title,
						}),
					);
					if (!guarded.ok) return guarded;
					const value = await guarded.value;
					if (value.ok) updateActiveTabIcon().catch(() => {});
					return { ok: true as const, value };
				}
				case "remove-item": {
					const guarded = auth.whenLoggedIn(() =>
						readingList.removeUrl(message.id),
					);
					if (!guarded.ok) return guarded;
					const value = await guarded.value;
					if (value.ok) updateActiveTabIcon().catch(() => {});
					return { ok: true as const, value };
				}
				case "check-url": {
					const guarded = auth.whenLoggedIn(() =>
						readingList.findByUrl(message.url),
					);
					if (!guarded.ok) return guarded;
					return { ok: true as const, value: await guarded.value };
				}
				case "get-all-items": {
					const guarded = auth.whenLoggedIn(() =>
						readingList.getAllItems(),
					);
					if (!guarded.ok) return guarded;
					return { ok: true as const, value: await guarded.value };
				}
			}
		};

		handle().then(sendResponse);
		return true;
	});

	browser.tabs.onActivated.addListener((activeInfo) => {
		browser.tabs
			.get(activeInfo.tabId)
			.then((tab) => {
				if (tab.url) {
					updateIconForTab(activeInfo.tabId, tab.url).catch(
						() => {},
					);
				}
			})
			.catch(() => {});
	});

	browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
		if (changeInfo.url) {
			updateIconForTab(tabId, changeInfo.url).catch(() => {});
		}
	});
}
