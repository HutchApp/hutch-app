import type {
	ReadingListItem,
	ReadingListItemId,
} from "../domain/reading-list-item.types";
import type { PopupMessage } from "../background/messages.types";
import { filterByUrl } from "./filter-by-url";
import type { GuardedResult } from "../providers/auth/auth.types";
import type {
	SaveUrlResult,
	RemoveUrlResult,
} from "../providers/reading-list/reading-list.types";
import type { LoginResult } from "../providers/auth/auth.types";

function showView(id: string) {
	for (const view of document.querySelectorAll(".view")) {
		(view as HTMLElement).hidden = true;
	}
	const target = document.getElementById(id);
	if (target) target.hidden = false;
}

function send(message: PopupMessage): Promise<unknown> {
	return browser.runtime.sendMessage(message);
}

let savedItemId: ReadingListItemId | null = null;
let allItems: ReadingListItem[] = [];

function renderLinks(items: ReadingListItem[]) {
	const linkList = document.getElementById("link-list") as HTMLElement;
	const emptyList = document.getElementById("empty-list") as HTMLElement;
	const noMatches = document.getElementById("no-matches") as HTMLElement;
	const listError = document.getElementById("list-error") as HTMLElement;

	linkList.innerHTML = "";
	emptyList.hidden = true;
	noMatches.hidden = true;
	listError.hidden = true;

	if (allItems.length === 0) {
		emptyList.hidden = false;
		return;
	}

	if (items.length === 0) {
		noMatches.hidden = false;
		return;
	}

	for (const item of items) {
		const div = document.createElement("div");
		div.className = "list-view__item";

		const link = document.createElement("a");
		link.className = "list-view__url";
		link.href = item.url;
		link.textContent = item.url;
		link.target = "_blank";
		link.rel = "noopener";

		div.appendChild(link);
		linkList.appendChild(div);
	}
}

function filterItems(): ReadingListItem[] {
	const filterInput = document.getElementById(
		"filter-input",
	) as HTMLInputElement;
	return filterByUrl(allItems, filterInput.value);
}

async function loadAllItems() {
	const result = (await send({
		type: "get-all-items",
	})) as GuardedResult<ReadingListItem[]>;

	if (!result.ok) {
		const listError = document.getElementById("list-error") as HTMLElement;
		listError.hidden = false;
		return;
	}

	allItems = result.value;
	renderLinks(filterItems());
}

async function showListView() {
	showView("list-view");
	await loadAllItems();
}

async function saveAndShowList() {
	const tabs = await browser.tabs.query({
		active: true,
		currentWindow: true,
	});
	const tab = tabs[0];
	if (!tab?.url) {
		await showListView();
		return;
	}

	const checkResult = (await send({
		type: "check-url",
		url: tab.url,
	})) as GuardedResult<ReadingListItem | null>;

	if (!checkResult.ok) {
		if (checkResult.reason === "not-logged-in") {
			showView("login-view");
			return;
		}
		return;
	}

	if (checkResult.value) {
		await showListView();
		return;
	}

	const saveResult = (await send({
		type: "save-current-tab",
		url: tab.url,
		title: tab.title ?? tab.url,
	})) as GuardedResult<SaveUrlResult>;

	if (saveResult.ok && saveResult.value.ok) {
		savedItemId = saveResult.value.item.id;
		showView("saved-view");
	}
}

document
	.getElementById("login-form")
	?.addEventListener("submit", async (e) => {
		e.preventDefault();
		const email = (document.getElementById("email") as HTMLInputElement)
			.value;
		const password = (
			document.getElementById("password") as HTMLInputElement
		).value;

		const result = (await send({
			type: "login",
			email,
			password,
		})) as LoginResult;

		if (result.ok) {
			showView("loading-view");
			await saveAndShowList();
		} else {
			const errorEl = document.getElementById("login-error");
			if (errorEl) errorEl.hidden = false;
		}
	});

document
	.getElementById("undo-button")
	?.addEventListener("click", async () => {
		if (!savedItemId) return;

		const result = (await send({
			type: "remove-item",
			id: savedItemId,
		})) as GuardedResult<RemoveUrlResult>;

		if (result.ok && result.value.ok) {
			savedItemId = null;
			await showListView();
		}
	});

document
	.getElementById("reload-button")
	?.addEventListener("click", async () => {
		await loadAllItems();
	});

document.getElementById("filter-input")?.addEventListener("input", () => {
	renderLinks(filterItems());
});

saveAndShowList().catch((error) => {
	console.error("Failed to initialize popup:", error);
	showView("list-view");
	const listError = document.getElementById("list-error") as HTMLElement;
	listError.hidden = false;
});
