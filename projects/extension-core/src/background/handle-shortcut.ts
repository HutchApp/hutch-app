import type { WhenLoggedIn } from "../providers/auth/auth.types";
import type { SaveUrlResult } from "../providers/reading-list/reading-list.types";
import type { QueryActiveTabs } from "../shell.types";

type ShortcutAction =
	| { action: "saved"; tabId: number; url: string }
	| { action: "open-login"; url: string; title: string; tabId: number; tabUrl: string }
	| { action: "focus-login-window"; windowId: number }
	| null;

export function initHandleShortcut(deps: {
	queryActiveTabs: QueryActiveTabs;
	whenLoggedIn: WhenLoggedIn;
	saveCurrentTab: (tab: { url: string; title: string }) => Promise<SaveUrlResult>;
	updateIconForTab: (tabId: number, url: string) => Promise<void>;
}) {
	let loginWindow: { id: number; tabId: number; tabUrl: string } | null = null;

	return {
		onShortcutPressed: async (): Promise<ShortcutAction> => {
			const tabs = await deps.queryActiveTabs();
			const tab = tabs[0];

			if (loginWindow) {
				return { action: "focus-login-window", windowId: loginWindow.id };
			}

			if (!tab?.url || tab.id == null) return null;

			const url = tab.url;
			const tabId = tab.id;
			const title = tab.title ?? url;

			const guarded = deps.whenLoggedIn(() =>
				deps.saveCurrentTab({ url, title }),
			);

			if (!guarded.ok) {
				return {
					action: "open-login",
					url,
					title,
					tabId,
					tabUrl: url,
				};
			}

			const result = await guarded.value;
			if (result.ok) {
				await deps.updateIconForTab(tabId, url);
				return { action: "saved", tabId, url };
			}

			return null;
		},

		onLoginWindowOpened: (windowId: number, tabId: number, tabUrl: string) => {
			loginWindow = { id: windowId, tabId, tabUrl };
		},

		onWindowRemoved: (windowId: number) => {
			if (loginWindow && windowId === loginWindow.id) {
				deps.updateIconForTab(loginWindow.tabId, loginWindow.tabUrl).catch(() => {});
				loginWindow = null;
			}
		},
	};
}
