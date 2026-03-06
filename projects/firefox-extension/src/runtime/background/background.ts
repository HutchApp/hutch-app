import { initInMemoryAuth } from "extension-core/providers/auth/in-memory-auth";
import { initInMemoryReadingList } from "extension-core/providers/reading-list/in-memory-reading-list";
import { initSaveCurrentTab } from "extension-core/background/save-current-tab";
import { initIconStatus } from "extension-core/background/icon-status";
import {
	MENU_ITEM_SAVE_LINK,
	MENU_ITEM_SAVE_PAGE,
	initSaveFromContextMenu,
} from "extension-core/background/save-from-context-menu";
import { initHandlePopupMessage } from "extension-core/background/handle-popup-message";
import { initHandleShortcut } from "extension-core/background/handle-shortcut";
import type { PopupMessage } from "extension-core/background/messages.types";
import { createBrowserSetIcon } from "./tinted-icon.browser";

const auth = initInMemoryAuth();
const readingList = initInMemoryReadingList();
const saveCurrentTab = initSaveCurrentTab({ saveUrl: readingList.saveUrl });
const { updateIconForTab } = initIconStatus({
	findByUrl: readingList.findByUrl,
	whenLoggedIn: auth.whenLoggedIn,
	setIcon: createBrowserSetIcon(),
});
const saveFromContextMenu = initSaveFromContextMenu({
	saveUrl: readingList.saveUrl,
});

const queryActiveTabs = () =>
	browser.tabs.query({ active: true, currentWindow: true });

async function updateActiveTabIcon() {
	const tabs = await queryActiveTabs();
	const tab = tabs[0];
	if (tab?.id != null && tab.url) {
		await updateIconForTab(tab.id, tab.url);
	}
}

const handlePopupMessage = initHandlePopupMessage({
	login: auth.login,
	logout: auth.logout,
	whenLoggedIn: auth.whenLoggedIn,
	saveCurrentTab,
	removeUrl: readingList.removeUrl,
	findByUrl: readingList.findByUrl,
	getAllItems: readingList.getAllItems,
	updateActiveTabIcon,
});

const shortcut = initHandleShortcut({
	queryActiveTabs,
	whenLoggedIn: auth.whenLoggedIn,
	saveCurrentTab,
	updateIconForTab,
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

browser.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
	if ((raw as { type: string }).type === "shortcut-pressed") {
		(async () => {
			const result = await shortcut.onShortcutPressed();

			if (result?.action === "focus-login-window") {
				await browser.windows.update(result.windowId, { focused: true });
				return;
			}

			if (result?.action === "open-login") {
				const params = `?url=${encodeURIComponent(result.url)}&title=${encodeURIComponent(result.title)}`;
				const win = await browser.windows.create({
					url: browser.runtime.getURL(
						`popup/popup.template.html${params}`,
					),
					type: "popup",
					width: 380,
					height: 520,
				});
				if (win.id != null) {
					shortcut.onLoginWindowOpened(win.id, result.tabId, result.tabUrl);
				}
			}
		})().catch(console.error);
		return;
	}

	const message = raw as PopupMessage;
	handlePopupMessage(message).then(sendResponse);
	return true;
});

browser.windows.onRemoved.addListener((windowId) => {
	shortcut.onWindowRemoved(windowId);
});

browser.tabs.onActivated.addListener((activeInfo) => {
	browser.tabs.get(activeInfo.tabId)
		.then((tab) => {
			if (tab.url) {
				updateIconForTab(activeInfo.tabId, tab.url).catch(() => {});
			}
		})
		.catch(() => {});
});

browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
	if (changeInfo.url) {
		updateIconForTab(tabId, changeInfo.url).catch(() => {});
	}
});
