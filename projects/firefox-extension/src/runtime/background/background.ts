import { initInMemoryAuth } from "../providers/auth/in-memory-auth";
import { initInMemoryReadingList } from "../providers/reading-list/in-memory-reading-list";
import { initHandleSaveCommand } from "./handle-save-command";
import type { PopupMessage } from "./messages.types";
import { initSaveCurrentTab } from "./save-current-tab";

const auth = initInMemoryAuth();
const readingList = initInMemoryReadingList();
const saveCurrentTab = initSaveCurrentTab({ saveUrl: readingList.saveUrl });

const ICON_DEFAULT = {
	"16": "icons/icon-16.png",
	"32": "icons/icon-32.png",
	"48": "icons/icon-48.png",
	"64": "icons/icon-64.png",
};

const ICON_SAVED = {
	"16": "icons-saved/icon-16.png",
	"32": "icons-saved/icon-32.png",
	"48": "icons-saved/icon-48.png",
	"64": "icons-saved/icon-64.png",
};

async function updateIconForTab(tabId: number, url: string) {
	const guarded = auth.whenLoggedIn(() => readingList.findByUrl(url));
	const isSaved = guarded.ok && (await guarded.value) !== null;
	await browser.browserAction.setIcon({
		tabId,
		path: isSaved ? ICON_SAVED : ICON_DEFAULT,
	});
}

browser.tabs.onActivated.addListener(async ({ tabId }) => {
	const tab = await browser.tabs.get(tabId);
	if (tab.url) await updateIconForTab(tabId, tab.url);
});

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
	if ((changeInfo.url || changeInfo.status === "complete") && tab.url) {
		await updateIconForTab(tabId, tab.url);
	}
});

const handleSaveCommand = initHandleSaveCommand({
	queryActiveTabs: () =>
		browser.tabs.query({ active: true, currentWindow: true }),
	whenLoggedIn: auth.whenLoggedIn,
	saveCurrentTab,
});

browser.commands.onCommand.addListener((command) => {
	if (command === "save-current-tab") {
		handleSaveCommand().catch(console.error);
	}
});

browser.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
	const message = raw as PopupMessage;

	const handle = async () => {
		switch (message.type) {
			case "login": {
				return auth.login({ email: message.email, password: message.password });
			}
			case "logout": {
				await auth.logout();
				const [activeTab] = await browser.tabs.query({
					active: true,
					currentWindow: true,
				});
				if (activeTab?.id && activeTab.url) {
					await updateIconForTab(activeTab.id, activeTab.url);
				}
				return { ok: true };
			}
			case "save-current-tab": {
				const guarded = auth.whenLoggedIn(() =>
					saveCurrentTab({ url: message.url, title: message.title }),
				);
				if (!guarded.ok) return guarded;
				const result = await guarded.value;
				const [activeTab] = await browser.tabs.query({
					active: true,
					currentWindow: true,
				});
				if (activeTab?.id && activeTab.url) {
					await updateIconForTab(activeTab.id, activeTab.url);
				}
				return { ok: true as const, value: result };
			}
			case "remove-item": {
				const guarded = auth.whenLoggedIn(() =>
					readingList.removeUrl(message.id),
				);
				if (!guarded.ok) return guarded;
				const result = await guarded.value;
				const [activeTab] = await browser.tabs.query({
					active: true,
					currentWindow: true,
				});
				if (activeTab?.id && activeTab.url) {
					await updateIconForTab(activeTab.id, activeTab.url);
				}
				return { ok: true as const, value: result };
			}
			case "check-url": {
				const guarded = auth.whenLoggedIn(() =>
					readingList.findByUrl(message.url),
				);
				if (!guarded.ok) return guarded;
				return { ok: true as const, value: await guarded.value };
			}
			case "get-all-items": {
				const guarded = auth.whenLoggedIn(() => readingList.getAllItems());
				if (!guarded.ok) return guarded;
				return { ok: true as const, value: await guarded.value };
			}
		}
	};

	handle().then(sendResponse);
	return true;
});
