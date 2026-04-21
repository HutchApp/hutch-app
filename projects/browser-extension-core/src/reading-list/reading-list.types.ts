import type {
	ReadingListItem,
	ReadingListItemId,
} from "../domain/reading-list-item.types";

export type SaveUrlResult =
	| { ok: true; item: ReadingListItem }
	| { ok: false; reason: "already-saved" };

export type RemoveUrlResult =
	| { ok: true; items: ReadingListItem[] }
	| { ok: false; reason: "not-found" };

export type SaveUrl = (params: {
	url: string;
	title: string;
}) => Promise<SaveUrlResult>;

export type RemoveUrl = (
	id: ReadingListItemId,
) => Promise<RemoveUrlResult>;

export type FindByUrl = (
	url: string,
) => Promise<ReadingListItem | null>;

export type GetAllItems = () => Promise<ReadingListItem[]>;
