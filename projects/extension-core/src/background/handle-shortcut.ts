import type { WhenLoggedIn } from "../providers/auth/auth.types";
import type { SaveUrlResult } from "../providers/reading-list/reading-list.types";

type QueryActiveTabs = () => Promise<Array<{ id?: number; url?: string; title?: string }>>;

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

			if (!tab?.url) return null;

			const url = tab.url;
			const title = tab.title ?? url;

			const guarded = deps.whenLoggedIn(() =>
				deps.saveCurrentTab({ url, title }),
			);

			if (!guarded.ok) {
				return {
					action: "open-login",
					url,
					title,
					tabId: tab.id ?? 0,
					tabUrl: url,
				};
			}

			const result = await guarded.value;
			if (result.ok && tab.id != null) {
				await deps.updateIconForTab(tab.id, url);
				return { action: "saved", tabId: tab.id, url };
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
