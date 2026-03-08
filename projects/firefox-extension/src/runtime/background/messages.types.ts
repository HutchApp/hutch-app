import type { ReadingListItemId } from "../domain/reading-list-item.types";

export type PopupMessage =
	| { type: "save-current-tab"; url: string; title: string }
	| { type: "remove-item"; id: ReadingListItemId }
	| { type: "check-url"; url: string }
	| { type: "get-all-items" }
	| { type: "login"; email: string; password: string }
	| { type: "oauth-login" }
	| { type: "logout" };
