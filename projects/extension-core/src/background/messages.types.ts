import type {
	ReadingListItem,
	ReadingListItemId,
} from "../domain/reading-list-item.types";
import type { GuardedResult, LoginResult } from "../providers/auth/auth.types";
import type {
	RemoveUrlResult,
	SaveUrlResult,
} from "../providers/reading-list/reading-list.types";

export type PopupMessage =
	| { type: "save-current-tab"; url: string; title: string }
	| { type: "remove-item"; id: ReadingListItemId }
	| { type: "check-url"; url: string }
	| { type: "get-all-items" }
	| { type: "login"; email: string; password: string }
	| { type: "logout" };

export type PopupMessageResponseMap = {
	"save-current-tab": GuardedResult<SaveUrlResult>;
	"remove-item": GuardedResult<RemoveUrlResult>;
	"check-url": GuardedResult<ReadingListItem | null>;
	"get-all-items": GuardedResult<ReadingListItem[]>;
	login: LoginResult;
	logout: { ok: true };
};

export type SendPopupMessage = <M extends PopupMessage>(
	message: M,
) => Promise<PopupMessageResponseMap[M["type"]]>;
