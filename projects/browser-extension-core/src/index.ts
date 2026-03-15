// Zod 4.x JIT-compiles validators with new Function(), which browser extension
// CSPs block. Zod catches the error and falls back, but Firefox still logs a
// noisy CSP violation on every popup open. Disabling JIT avoids the attempt.
import { config } from "zod";
config({ jitless: true });

export { BrowserExtensionCore } from "./core";
export type { Core, CoreError, ResultHandler, ReadingList } from "./core";
export type { BrowserShell } from "./shell.types";
export type { SetIcon } from "./icon-status";
export type {
	ReadingListItem,
	ReadingListItemId,
} from "./domain/reading-list-item.types";
export type {
	SaveUrlResult,
	RemoveUrlResult,
} from "./reading-list/reading-list.types";
export type {
	Auth,
	GuardedResult,
	LoginResult,
	RefreshResult,
	OAuthAuthDeps,
	OAuthTokens,
	TokenStorage,
} from "./auth/auth.types";
export { initOAuthAuth } from "./auth/oauth-auth";
export { initSirenReadingList } from "./reading-list/siren-reading-list";
export type { SirenReadingListDeps } from "./reading-list/siren-reading-list";
export type { SaveUrl, RemoveUrl, FindByUrl, GetAllItems } from "./reading-list/reading-list.types";
export type { PopupMessage } from "./popup-message.types";
export { filterByUrl } from "./popup/filter-by-url";
export { paginateItems } from "./popup/paginate-items";
export {
	MENU_ITEM_SAVE_PAGE,
	MENU_ITEM_SAVE_LINK,
} from "./save-from-context-menu";
