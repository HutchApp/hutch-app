import type { SetIcon } from "./icon-status";

export interface BrowserShell {
	onShortcutPressed: (handler: () => void) => void;
	openLoginScreen: (params: { url: string; title: string }) => void;
	focusLoginWindow: () => void;
	getActiveTab: () => Promise<{ id?: number; url: string; title: string } | null>;
	queryActiveTabs: () => Promise<Array<{ id?: number; url?: string; title?: string }>>;
	setIcon: SetIcon;
	createContextMenus: () => void;
	onContextMenuClicked: (handler: (info: {
		menuItemId: string;
		linkUrl?: string;
		pageUrl?: string;
	}, tab?: { url?: string; title?: string }) => void) => void;
	onTabActivated: (handler: (tabId: number, url: string) => void) => void;
	onTabUpdated: (handler: (tabId: number, url: string) => void) => void;
	onLoginWindowClosed: (handler: () => void) => void;
}
