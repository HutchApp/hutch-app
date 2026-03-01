import type { WhenLoggedIn } from "../providers/auth/auth.types";
import type { SaveUrlResult } from "../providers/reading-list/reading-list.types";

export function initHandleSaveCommand(deps: {
	queryActiveTabs: () => Promise<browser.tabs.Tab[]>;
	whenLoggedIn: WhenLoggedIn;
	saveCurrentTab: (tab: { url: string; title: string }) => Promise<SaveUrlResult>;
}): () => Promise<SaveUrlResult | null> {
	return async () => {
		const tabs = await deps.queryActiveTabs();
		const tab = tabs[0];
		if (!tab?.url) return null;

		const url = tab.url;
		const title = tab.title ?? url;
		const guarded = deps.whenLoggedIn(() =>
			deps.saveCurrentTab({ url, title }),
		);
		if (!guarded.ok) return null;

		return guarded.value;
	};
}
