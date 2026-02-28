import type {
	ReadingListItem,
	ReadingListItemId,
} from "../../domain/reading-list-item.types";
import type {
	FindByUrl,
	GetAllItems,
	RemoveUrl,
	SaveUrl,
} from "./reading-list.types";

export function initInMemoryReadingList(): {
	saveUrl: SaveUrl;
	removeUrl: RemoveUrl;
	findByUrl: FindByUrl;
	getAllItems: GetAllItems;
} {
	const items = new Map<ReadingListItemId, ReadingListItem>();

	const saveUrl: SaveUrl = async ({ url, title }) => {
		for (const item of items.values()) {
			if (item.url === url) {
				return { ok: false, reason: "already-saved" };
			}
		}

		const id = crypto.randomUUID() as ReadingListItemId;
		const item: ReadingListItem = {
			id,
			url,
			title,
			savedAt: new Date(),
		};
		items.set(id, item);
		return { ok: true, item };
	};

	const removeUrl: RemoveUrl = async (id) => {
		if (!items.has(id)) {
			return { ok: false, reason: "not-found" };
		}
		items.delete(id);
		return { ok: true };
	};

	const findByUrl: FindByUrl = async (url) => {
		for (const item of items.values()) {
			if (item.url === url) {
				return item;
			}
		}
		return null;
	};

	const getAllItems: GetAllItems = async () => {
		return Array.from(items.values());
	};

	return {
		saveUrl,
		removeUrl,
		findByUrl,
		getAllItems,
	};
}
