import type {
	ReadingListItem,
	ReadingListItemId,
} from "../domain/reading-list-item.types";
import type { SendPopupMessage } from "../background/messages.types";
import { filterByUrl } from "./filter-by-url";
import { paginateItems } from "./paginate-items";

export type PopupView =
	| { view: "loading" }
	| { view: "login" }
	| { view: "saved"; itemId: ReadingListItemId }
	| { view: "list"; items: ReadingListItem[]; page: number; totalPages: number; visiblePages: number[] }
	| { view: "error" };

export function initPopupFlow(deps: {
	sendMessage: SendPopupMessage;
	getActiveTab: () => Promise<{ url: string; title: string } | null>;
}) {
	let savedItemId: ReadingListItemId | null = null;
	let allItems: ReadingListItem[] = [];
	let currentPage = 1;
	let filterQuery = "";

	function buildListView(): PopupView {
		const filtered = filterByUrl(allItems, filterQuery);
		const sorted = [...filtered].sort(
			(a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
		);
		const paginated = paginateItems(sorted, currentPage);
		currentPage = paginated.currentPage;

		return {
			view: "list",
			items: paginated.items,
			page: paginated.currentPage,
			totalPages: paginated.totalPages,
			visiblePages: paginated.visiblePages,
		};
	}

	async function loadAllItems(): Promise<PopupView> {
		const result = await deps.sendMessage({
			type: "get-all-items",
		});

		if (!result.ok) {
			return { view: "error" };
		}

		allItems = result.value;
		return buildListView();
	}

	return {
		start: async (): Promise<PopupView> => {
			const activeTab = await deps.getActiveTab();
			if (!activeTab) {
				return loadAllItems();
			}

			const checkResult = await deps.sendMessage({
				type: "check-url",
				url: activeTab.url,
			});

			if (!checkResult.ok) {
				if (checkResult.reason === "not-logged-in") {
					return { view: "login" };
				}
				return { view: "error" };
			}

			if (checkResult.value) {
				return loadAllItems();
			}

			const saveResult = await deps.sendMessage({
				type: "save-current-tab",
				url: activeTab.url,
				title: activeTab.title,
			});

			if (saveResult.ok && saveResult.value.ok) {
				savedItemId = saveResult.value.item.id;
				return { view: "saved", itemId: savedItemId };
			}

			return loadAllItems();
		},

		login: async (): Promise<PopupView> => {
			const result = await deps.sendMessage({
				type: "login",
			});

			if (!result.ok) {
				return { view: "login" };
			}

			const activeTab = await deps.getActiveTab();
			if (!activeTab) {
				return loadAllItems();
			}

			const saveResult = await deps.sendMessage({
				type: "save-current-tab",
				url: activeTab.url,
				title: activeTab.title,
			});

			if (saveResult.ok && saveResult.value.ok) {
				savedItemId = saveResult.value.item.id;
				return { view: "saved", itemId: savedItemId };
			}

			return loadAllItems();
		},

		undo: async (): Promise<PopupView> => {
			if (!savedItemId) return loadAllItems();

			const result = await deps.sendMessage({
				type: "remove-item",
				id: savedItemId,
			});

			if (result.ok && result.value.ok) {
				savedItemId = null;
			}

			return loadAllItems();
		},

		removeItem: async (id: ReadingListItemId): Promise<PopupView> => {
			const result = await deps.sendMessage({
				type: "remove-item",
				id,
			});

			if (result.ok && result.value.ok) {
				allItems = allItems.filter((i) => i.id !== id);
			}

			return buildListView();
		},

		filter: (query: string): PopupView => {
			filterQuery = query;
			currentPage = 1;
			return buildListView();
		},

		goToPage: (page: number): PopupView => {
			currentPage = page;
			return buildListView();
		},

		logout: async (): Promise<PopupView> => {
			await deps.sendMessage({ type: "logout" });
			return { view: "login" };
		},

		reload: async (): Promise<PopupView> => {
			return loadAllItems();
		},
	};
}
