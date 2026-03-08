import type { SaveUrl, SaveUrlResult } from "./reading-list/reading-list.types";

export const MENU_ITEM_SAVE_PAGE = "save-page-to-hutch";
export const MENU_ITEM_SAVE_LINK = "save-link-to-hutch";

interface ClickInfo {
	menuItemId: string;
	linkUrl?: string;
	pageUrl?: string;
}

interface TabInfo {
	url?: string;
	title?: string;
}

export function initSaveFromContextMenu(deps: {
	saveUrl: SaveUrl;
}): (info: ClickInfo, tab?: TabInfo) => Promise<SaveUrlResult | null> {
	return async (info, tab) => {
		if (info.menuItemId === MENU_ITEM_SAVE_LINK && info.linkUrl) {
			return deps.saveUrl({ url: info.linkUrl, title: info.linkUrl });
		}

		if (info.menuItemId === MENU_ITEM_SAVE_PAGE) {
			const url = info.pageUrl ?? tab?.url;
			if (!url) return null;
			return deps.saveUrl({ url, title: tab?.title ?? url });
		}

		return null;
	};
}
