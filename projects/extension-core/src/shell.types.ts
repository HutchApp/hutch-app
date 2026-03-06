import type { SetIcon } from "./background/icon-status";

export type QueryActiveTabs = () => Promise<Array<{ id?: number; url?: string; title?: string }>>;

export type GetTabById = (tabId: number) => Promise<{ url?: string }>;

export type OpenLoginWindow = (params: {
	popupUrl: string;
	width: number;
	height: number;
}) => Promise<{ id: number | null }>;

export type FocusWindow = (windowId: number) => Promise<void>;

export type SendMessageToBackground = (message: unknown) => Promise<unknown>;

export type OnTabActivated = (callback: (tabId: number) => void) => void;
export type OnTabUrlChanged = (callback: (tabId: number, url: string) => void) => void;
export type OnWindowRemoved = (callback: (windowId: number) => void) => void;

export type BackgroundShell = {
	queryActiveTabs: QueryActiveTabs;
	getTabById: GetTabById;
	setIcon: SetIcon;
	openLoginWindow: OpenLoginWindow;
	focusWindow: FocusWindow;
	getExtensionUrl: (path: string) => string;
	onTabActivated: OnTabActivated;
	onTabUrlChanged: OnTabUrlChanged;
	onWindowRemoved: OnWindowRemoved;
};

export type PopupShell = {
	sendMessage: SendMessageToBackground;
	queryActiveTabs: QueryActiveTabs;
	getUrlParams: () => { url: string | null; title: string | null };
};
