import {
	BrowserExtensionCore,
	MENU_ITEM_SAVE_PAGE,
	MENU_ITEM_SAVE_LINK,
	type BrowserShell,
	type PopupMessage,
	type ReadingListItem,
	type SaveUrlResult,
	type RemoveUrlResult,
} from "browser-extension-core";
import { createBrowserSetIcon } from "./tinted-icon.browser";

let loginWindow: { id: number; tabId: number; tabUrl: string } | null = null;

const shell: BrowserShell = {
	onShortcutPressed(handler) {
		browser.runtime.onMessage.addListener((raw, _sender, _sendResponse) => {
			if ((raw as { type: string }).type === "shortcut-pressed") {
				handler();
			}
			return undefined;
		});
	},

	openLoginScreen({ url, title }) {
		const params = `?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
		browser.tabs
			.query({ active: true, currentWindow: true })
			.then(async (tabs) => {
				const tab = tabs[0];
				const win = await browser.windows.create({
					url: browser.runtime.getURL(
						`popup/popup.template.html${params}`,
					),
					type: "popup",
					width: 380,
					height: 520,
				});
				if (win.id != null && tab?.id != null) {
					loginWindow = { id: win.id, tabId: tab.id, tabUrl: url };
				}
			})
			.catch(console.error);
	},

	focusLoginWindow() {
		if (loginWindow) {
			browser.windows
				.update(loginWindow.id, { focused: true })
				.catch(console.error);
		}
	},

	getActiveTab: async () => {
		const tabs = await browser.tabs.query({
			active: true,
			currentWindow: true,
		});
		const tab = tabs[0];
		if (!tab?.url) return null;
		return { id: tab.id, url: tab.url, title: tab.title ?? tab.url };
	},

	queryActiveTabs: () =>
		browser.tabs.query({ active: true, currentWindow: true }),

	setIcon: createBrowserSetIcon(),

	createContextMenus() {
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
	},

	onContextMenuClicked(handler) {
		browser.menus.onClicked.addListener((info, tab) => {
			handler(info, tab);
		});
	},

	onTabActivated(handler) {
		browser.tabs.onActivated.addListener((activeInfo) => {
			browser.tabs
				.get(activeInfo.tabId)
				.then((tab) => {
					if (tab.url) {
						handler(activeInfo.tabId, tab.url);
					}
				})
				.catch(() => {});
		});
	},

	onTabUpdated(handler) {
		browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
			if (changeInfo.url) {
				handler(tabId, changeInfo.url);
			}
		});
	},

	onLoginWindowClosed(handler) {
		browser.windows.onRemoved.addListener((windowId) => {
			if (loginWindow && windowId === loginWindow.id) {
				loginWindow = null;
				handler();
			}
		});
	},
};

const core = BrowserExtensionCore(shell);

core.on("pre-init", () => {
	shell.createContextMenus();
});

core.init();

browser.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
	if ((raw as { type: string }).type === "shortcut-pressed") {
		return;
	}

	const message = raw as PopupMessage;

	switch (message.type) {
		case "login": {
			const pending = new Promise<unknown>((resolve) => {
				core.once("logged-in", {
					success: () => resolve({ ok: true }),
					failure: (err) => resolve({ ok: false, ...err }),
				});
			});
			core.login();
			pending.then(sendResponse);
			return true;
		}
		case "logout": {
			core.logout();
			sendResponse({ ok: true });
			return;
		}
		case "save-current-tab": {
			const pending = new Promise<unknown>((resolve) => {
				core.once("saved-current-tab", {
					success: (value: SaveUrlResult) =>
						resolve({ ok: true, value }),
					failure: (err) => resolve({ ok: false, ...err }),
				});
			});
			core.save("current-tab", {
				url: message.url,
				title: message.title,
			});
			pending.then(sendResponse);
			return true;
		}
		case "remove-item": {
			const pending = new Promise<unknown>((resolve) => {
				core.once("removed-item", {
					success: (value: RemoveUrlResult) =>
						resolve({ ok: true, value }),
					failure: (err) => resolve({ ok: false, ...err }),
				});
			});
			core.remove("item", { id: message.id });
			pending.then(sendResponse);
			return true;
		}
		case "check-url": {
			const pending = new Promise<unknown>((resolve) => {
				core.once("checked-url", {
					success: (value: ReadingListItem | null) =>
						resolve({ ok: true, value }),
					failure: (err) => resolve({ ok: false, ...err }),
				});
			});
			core.check("url", { url: message.url });
			pending.then(sendResponse);
			return true;
		}
		case "get-all-items": {
			const pending = new Promise<unknown>((resolve) => {
				core.once("fetched-reading-list", {
					success: (value: ReadingListItem[]) =>
						resolve({ ok: true, value }),
					failure: (err) => resolve({ ok: false, ...err }),
				});
			});
			core.fetch("reading-list");
			pending.then(sendResponse);
			return true;
		}
	}
});
