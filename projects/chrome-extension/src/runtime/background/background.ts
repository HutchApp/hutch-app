import {
	BrowserExtensionCore,
	initOAuthAuth,
	initSirenReadingList,
	MENU_ITEM_SAVE_PAGE,
	MENU_ITEM_SAVE_LINK,
	type BrowserShell,
	type OAuthTokens,
	type PopupMessage,
	type ReadingListItem,
	type SaveUrlResult,
	type RemoveUrlResult,
	type TokenStorage,
} from "browser-extension-core";
import { HutchLogger, consoleLogger } from "hutch-logger";
import { createChromeSetIcon } from "./tinted-icon.browser";

const logger = HutchLogger.from(consoleLogger);

const STORAGE_KEY = "hutch_oauth_tokens";
declare const __SERVER_URL__: string;
const SERVER_URL = __SERVER_URL__;
const CLIENT_ID = "hutch-chrome-extension";

const tokenStorage: TokenStorage = {
	async getTokens(): Promise<OAuthTokens | null> {
		const result = await chrome.storage.local.get(STORAGE_KEY);
		const raw = result[STORAGE_KEY];
		if (!raw) return null;
		return raw as OAuthTokens;
	},
	async setTokens(tokens: OAuthTokens): Promise<void> {
		await chrome.storage.local.set({ [STORAGE_KEY]: tokens });
	},
	async clearTokens(): Promise<void> {
		await chrome.storage.local.remove(STORAGE_KEY);
	},
};

let loginWindow: { id: number; tabId: number; tabUrl: string } | null = null;

const shell: BrowserShell = {
	onShortcutPressed(handler) {
		chrome.runtime.onMessage.addListener((raw, _sender, _sendResponse) => {
			if ((raw as { type: string }).type === "shortcut-pressed") {
				handler();
			}
			return undefined;
		});
	},

	openLoginScreen({ url, title }) {
		const params = `?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
		chrome.tabs
			.query({ active: true, currentWindow: true })
			.then(async (tabs) => {
				const tab = tabs[0];
				const win = await chrome.windows.create({
					url: chrome.runtime.getURL(
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
			.catch((err) => logger.error(err));
	},

	focusLoginWindow() {
		if (loginWindow) {
			chrome.windows
				.update(loginWindow.id, { focused: true })
				.catch((err) => logger.error(err));
		}
	},

	getActiveTab: async () => {
		const tabs = await chrome.tabs.query({
			active: true,
			currentWindow: true,
		});
		const tab = tabs[0];
		if (!tab?.url) return null;
		return { id: tab.id, url: tab.url, title: tab.title ?? tab.url };
	},

	queryActiveTabs: () =>
		chrome.tabs.query({ active: true, currentWindow: true }),

	setIcon: createChromeSetIcon(),

	createContextMenus() {
		chrome.contextMenus.create({
			id: MENU_ITEM_SAVE_PAGE,
			title: "Save Page to Hutch",
			contexts: ["page"],
		});
		chrome.contextMenus.create({
			id: MENU_ITEM_SAVE_LINK,
			title: "Save Link to Hutch",
			contexts: ["link"],
		});
	},

	onContextMenuClicked(handler) {
		chrome.contextMenus.onClicked.addListener((info, tab) => {
			handler(info, tab);
		});
	},

	onTabActivated(handler) {
		chrome.tabs.onActivated.addListener((activeInfo) => {
			chrome.tabs
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
		chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
			if (changeInfo.url) {
				handler(tabId, changeInfo.url);
			}
		});
	},

	onLoginWindowClosed(handler) {
		chrome.windows.onRemoved.addListener((windowId) => {
			if (loginWindow && windowId === loginWindow.id) {
				loginWindow = null;
				handler();
			}
		});
	},
};

async function initCore() {
	const auth = await initOAuthAuth({
		serverUrl: SERVER_URL,
		clientId: CLIENT_ID,
		async openTab(url: string): Promise<number> {
			const tab = await chrome.tabs.create({ url });
			if (tab.id == null) throw new Error("Created tab has no id");
			return tab.id;
		},
		waitForRedirect({ tabId, urlPrefix }): Promise<string> {
			return new Promise((resolve, reject) => {
				const cleanup = () => {
					clearTimeout(timer);
					chrome.tabs.onUpdated.removeListener(listener);
				};
				const listener = (
					updatedTabId: number,
					changeInfo: { url?: string },
				) => {
					if (updatedTabId === tabId && changeInfo.url?.startsWith(urlPrefix)) {
						cleanup();
						resolve(changeInfo.url);
					}
				};
				const timer = setTimeout(() => {
					cleanup();
					reject(new Error("OAuth login timed out after 5 minutes"));
				}, 5 * 60 * 1000);
				chrome.tabs.onUpdated.addListener(listener);
			});
		},
		async closeTab(tabId: number): Promise<void> {
			await chrome.tabs.remove(tabId);
		},
		fetchFn: (...args) => fetch(...args),
		tokenStorage,
		logger,
	});

	const readingList = initSirenReadingList({
		serverUrl: SERVER_URL,
		getAccessToken: auth.getAccessToken,
		fetchFn: (...args) => fetch(...args),
	});

	const core = BrowserExtensionCore(shell, { auth, logger, readingList });

	core.on("pre-init", () => {
		shell.createContextMenus();
	});

	core.init();

	return core;
}

const corePromise = initCore();

chrome.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
	if ((raw as { type: string }).type === "shortcut-pressed") {
		return;
	}

	const message = raw as PopupMessage;

	corePromise
		.then((core) => {
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
					break;
				}
				case "logout": {
					core.logout();
					sendResponse({ ok: true });
					break;
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
					break;
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
					break;
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
					break;
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
					break;
				}
			}
		});

	return true;
});
