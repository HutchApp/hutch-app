import type { WhenLoggedIn } from "../providers/auth/auth.types";
import type { ReadingListItem } from "../domain/reading-list-item.types";
import type {
	SaveUrlResult,
	FindByUrl,
	RemoveUrl,
} from "../providers/reading-list/reading-list.types";

type ToggleResult =
	| { action: "saved"; item: ReadingListItem }
	| { action: "removed" }
	| { action: "not-logged-in" }
	| null;

export function initHandleToggleCommand(deps: {
	queryActiveTabs: () => Promise<browser.tabs.Tab[]>;
	whenLoggedIn: WhenLoggedIn;
	saveCurrentTab: (tab: { url: string; title: string }) => Promise<SaveUrlResult>;
	findByUrl: FindByUrl;
	removeUrl: RemoveUrl;
}): () => Promise<ToggleResult> {
	return async () => {
		const tabs = await deps.queryActiveTabs();
		const tab = tabs[0];
		if (!tab?.url) return null;

		const url = tab.url;
		const title = tab.title ?? url;

		const findGuarded = deps.whenLoggedIn(() => deps.findByUrl(url));
		if (!findGuarded.ok) return { action: "not-logged-in" };

		const existing = await findGuarded.value;
		if (existing) {
			const removeGuarded = deps.whenLoggedIn(() =>
				deps.removeUrl(existing.id),
			);
			if (!removeGuarded.ok) return null;
			await removeGuarded.value;
			return { action: "removed" };
		}

		const saveGuarded = deps.whenLoggedIn(() =>
			deps.saveCurrentTab({ url, title }),
		);
		if (!saveGuarded.ok) return null;

		const result = await saveGuarded.value;
		if (!result.ok) return null;
		return { action: "saved", item: result.item };
	};
}
