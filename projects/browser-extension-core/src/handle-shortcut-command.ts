import type { ReadingListItem } from "./domain/reading-list-item.types";
import type { WhenLoggedIn } from "./auth/auth.types";
import type { SaveUrlResult } from "./reading-list/reading-list.types";

type TabInfo = { url: string; title: string };

type ShortcutResult =
	| { action: "saved"; item: ReadingListItem }
	| { action: "not-logged-in"; url: string; title: string }
	| { action: "login-window-focused" }
	| null;

export function initHandleShortcutCommand(deps: {
	queryActiveTabs: () => Promise<Array<{ id?: number; url?: string; title?: string }>>;
	whenLoggedIn: WhenLoggedIn;
	saveCurrentTab: (tab: TabInfo) => Promise<SaveUrlResult>;
	hasLoginWindow: () => boolean;
}): () => Promise<ShortcutResult> {
	return async () => {
		if (deps.hasLoginWindow()) {
			return { action: "login-window-focused" };
		}

		const tabs = await deps.queryActiveTabs();
		const tab = tabs[0];
		if (!tab?.url) return null;

		const url = tab.url;
		const title = tab.title ?? url;

		const guarded = deps.whenLoggedIn(() =>
			deps.saveCurrentTab({ url, title }),
		);

		if (!guarded.ok) {
			return { action: "not-logged-in", url, title };
		}

		const result = await guarded.value;
		if (!result.ok) return null;
		return { action: "saved", item: result.item };
	};
}
