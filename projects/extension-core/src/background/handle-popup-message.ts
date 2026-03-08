import type { Login, Logout, WhenLoggedIn } from "../providers/auth/auth.types";
import type {
	FindByUrl,
	GetAllItems,
	RemoveUrl,
	SaveUrlResult,
} from "../providers/reading-list/reading-list.types";
import type { PopupMessage } from "./messages.types";

export function initHandlePopupMessage(deps: {
	login: Login;
	logout: Logout;
	whenLoggedIn: WhenLoggedIn;
	saveCurrentTab: (tab: { url: string; title: string }) => Promise<SaveUrlResult>;
	removeUrl: RemoveUrl;
	findByUrl: FindByUrl;
	getAllItems: GetAllItems;
	updateActiveTabIcon: () => Promise<void>;
}) {
	return async (message: PopupMessage) => {
		switch (message.type) {
			case "login": {
				const result = await deps.login();
				if (result.ok) deps.updateActiveTabIcon().catch(() => {});
				return result;
			}
			case "logout": {
				await deps.logout();
				deps.updateActiveTabIcon().catch(() => {});
				return { ok: true };
			}
			case "save-current-tab": {
				const guarded = deps.whenLoggedIn(() =>
					deps.saveCurrentTab({ url: message.url, title: message.title }),
				);
				if (!guarded.ok) return guarded;
				const value = await guarded.value;
				if (value.ok) deps.updateActiveTabIcon().catch(() => {});
				return { ok: true as const, value };
			}
			case "remove-item": {
				const guarded = deps.whenLoggedIn(() =>
					deps.removeUrl(message.id),
				);
				if (!guarded.ok) return guarded;
				const value = await guarded.value;
				if (value.ok) deps.updateActiveTabIcon().catch(() => {});
				return { ok: true as const, value };
			}
			case "check-url": {
				const guarded = deps.whenLoggedIn(() =>
					deps.findByUrl(message.url),
				);
				if (!guarded.ok) return guarded;
				return { ok: true as const, value: await guarded.value };
			}
			case "get-all-items": {
				const guarded = deps.whenLoggedIn(() => deps.getAllItems());
				if (!guarded.ok) return guarded;
				return { ok: true as const, value: await guarded.value };
			}
		}
	};
}
