import type { SaveUrl, SaveUrlResult } from "../providers/reading-list/reading-list.types";

export interface TabInfo {
	url: string;
	title: string;
}

export function initSaveCurrentTab(deps: {
	saveUrl: SaveUrl;
}): (tab: TabInfo) => Promise<SaveUrlResult> {
	return (tab) => deps.saveUrl({ url: tab.url, title: tab.title });
}
