import type {
	GuardedResult,
	PopupMessage,
	ReadingListItem,
	ReadingListItemId,
	RemoveUrlResult,
	SaveUrlResult,
} from "browser-extension-core";
import { filterByUrl, paginateItems } from "browser-extension-core";

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

function showErrorToast(message: string) {
	const toast = document.getElementById("error-toast");
	if (!toast) return;
	toast.textContent = message;
	toast.hidden = false;
	setTimeout(() => {
		toast.hidden = true;
	}, 3000);
}

let savedItemId: ReadingListItemId | null = null;
let allItems: ReadingListItem[] = [];
let currentPage = 1;

function renderPagination(totalPages: number, visiblePages: number[]) {
	const pagination = document.getElementById("pagination");
	if (!pagination) throw new Error("pagination element not found");

	pagination.innerHTML = "";

	if (totalPages <= 1) {
		pagination.hidden = true;
		return;
	}

	pagination.hidden = false;

	const prevButton = document.createElement("button");
	prevButton.className = "pagination__button";
	prevButton.textContent = "\u2039";
	prevButton.title = "Previous page";
	prevButton.setAttribute("aria-label", "Previous page");
	prevButton.disabled = currentPage <= 1;
	prevButton.addEventListener("click", () => {
		currentPage--;
		renderLinks(filterItems());
	});
	pagination.appendChild(prevButton);

	for (const page of visiblePages) {
		const pageButton = document.createElement("button");
		pageButton.className = "pagination__page";
		if (page === currentPage) {
			pageButton.classList.add("pagination__page--active");
		}
		pageButton.textContent = String(page);
		pageButton.addEventListener("click", () => {
			currentPage = page;
			renderLinks(filterItems());
		});
		pagination.appendChild(pageButton);
	}

	const nextButton = document.createElement("button");
	nextButton.className = "pagination__button";
	nextButton.textContent = "\u203A";
	nextButton.title = "Next page";
	nextButton.setAttribute("aria-label", "Next page");
	nextButton.disabled = currentPage >= totalPages;
	nextButton.addEventListener("click", () => {
		currentPage++;
		renderLinks(filterItems());
	});
	pagination.appendChild(nextButton);
}

function renderLinks(items: ReadingListItem[]) {
	const linkList = document.getElementById("link-list");
	const emptyList = document.getElementById("empty-list");
	const noMatches = document.getElementById("no-matches");
	const listError = document.getElementById("list-error");

	if (!linkList) throw new Error("link-list element not found");
	if (!emptyList) throw new Error("empty-list element not found");
	if (!noMatches) throw new Error("no-matches element not found");
	if (!listError) throw new Error("list-error element not found");

	linkList.innerHTML = "";
	emptyList.hidden = true;
	noMatches.hidden = true;
	listError.hidden = true;

	if (allItems.length === 0) {
		emptyList.hidden = false;
		renderPagination(1, [1]);
		return;
	}

	if (items.length === 0) {
		noMatches.hidden = false;
		renderPagination(1, [1]);
		return;
	}

	const sorted = [...items].sort(
		(a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
	);

	const paginated = paginateItems(sorted, currentPage);
	currentPage = paginated.currentPage;

	for (const item of paginated.items) {
		const div = document.createElement("div");
		div.className = "list-view__item";

		const textContainer = document.createElement("div");
		textContainer.className = "list-view__text";

		const link = document.createElement("a");
		link.className = "list-view__item-title";
		link.href = item.url;
		link.textContent = item.title;
		link.target = "_blank";
		link.rel = "noopener noreferrer";

		const domain = document.createElement("span");
		domain.className = "list-view__domain";
		try {
			domain.textContent = new URL(item.url).hostname;
		} catch {
			domain.textContent = item.url;
		}

		textContainer.appendChild(link);
		textContainer.appendChild(domain);

		const deleteButton = document.createElement("button");
		deleteButton.className = "list-view__delete";
		deleteButton.textContent = "×";
		deleteButton.title = "Remove from list";
		deleteButton.addEventListener("click", async () => {
			try {
				const result = (await send({
					type: "remove-item",
					id: item.id,
				})) as GuardedResult<RemoveUrlResult>;

				if (result.ok && result.value.ok) {
					allItems = allItems.filter((i) => i.id !== item.id);
					renderLinks(filterItems());
				} else {
					showErrorToast("Failed to remove");
				}
			} catch {
				showErrorToast("Failed to remove");
			}
		});

		div.appendChild(textContainer);
		div.appendChild(deleteButton);
		linkList.appendChild(div);
	}

	renderPagination(paginated.totalPages, paginated.visiblePages);
}

function filterItems(): ReadingListItem[] {
	const filterInput = document.getElementById("filter-input");
	if (!filterInput) throw new Error("filter-input element not found");
	return filterByUrl(allItems, (filterInput as HTMLInputElement).value);
}

async function loadAllItems() {
	try {
		const result = (await send({
			type: "get-all-items",
		})) as GuardedResult<ReadingListItem[]>;

		if (!result.ok) {
			const listError = document.getElementById("list-error");
			if (!listError) throw new Error("list-error element not found");
			listError.hidden = false;
			return;
		}

		allItems = result.value;
		renderLinks(filterItems());
	} catch {
		const listError = document.getElementById("list-error");
		if (listError) listError.hidden = false;
	}
}

async function showListView() {
	showView("list-view");
	await loadAllItems();
}

async function getActiveTab(): Promise<{ url: string; title: string } | null> {
	const params = new URLSearchParams(window.location.search);
	const paramUrl = params.get("url");
	if (paramUrl)
		return { url: paramUrl, title: params.get("title") ?? paramUrl };

	const tabs = await browser.tabs.query({ active: true, currentWindow: true });
	const tab = tabs[0];
	if (!tab?.url) return null;
	return { url: tab.url, title: tab.title ?? tab.url };
}

async function saveAndShowList() {
	const activeTab = await getActiveTab();
	if (!activeTab) {
		await showListView();
		return;
	}

	const checkResult = (await send({
		type: "check-url",
		url: activeTab.url,
	})) as GuardedResult<ReadingListItem | null>;

	if (!checkResult.ok) {
		if (checkResult.reason === "not-logged-in") {
			showView("login-view");
			return;
		}
		showView("error-view");
		return;
	}

	if (checkResult.value) {
		await showListView();
		return;
	}

	const saveResult = (await send({
		type: "save-current-tab",
		url: activeTab.url,
		title: activeTab.title,
	})) as GuardedResult<SaveUrlResult>;

	if (saveResult.ok && saveResult.value.ok) {
		savedItemId = saveResult.value.item.id;
		showView("saved-view");
		return;
	}

	await showListView();
	showErrorToast("Failed to save");
}

document.getElementById("login-button")?.addEventListener("click", async () => {
	const loginError = document.getElementById("login-error");
	if (loginError) loginError.hidden = true;

	try {
		const result = (await send({ type: "login" })) as { ok: boolean };
		if (!result.ok) {
			if (loginError) loginError.hidden = false;
			return;
		}
	} catch {
		if (loginError) loginError.hidden = false;
		return;
	}

	showView("loading-view");
	try {
		await saveAndShowList();
	} catch (error) {
		console.error("Failed to load after login:", error);
		showView("error-view");
	}
});

document.getElementById("undo-button")?.addEventListener("click", async () => {
	if (!savedItemId) return;

	try {
		const result = (await send({
			type: "remove-item",
			id: savedItemId,
		})) as GuardedResult<RemoveUrlResult>;

		if (result.ok && result.value.ok) {
			savedItemId = null;
			await showListView();
		} else {
			showErrorToast("Failed to undo");
		}
	} catch {
		showErrorToast("Failed to undo");
	}
});

document
	.getElementById("reload-button")
	?.addEventListener("click", async () => {
		await loadAllItems();
	});

document
	.getElementById("logout-button")
	?.addEventListener("click", async () => {
		try {
			await send({ type: "logout" });
			showView("login-view");
		} catch {
			showErrorToast("Failed to log out");
		}
	});

document.getElementById("filter-input")?.addEventListener("input", () => {
	currentPage = 1;
	renderLinks(filterItems());
});

document.getElementById("retry-button")?.addEventListener("click", () => {
	showView("loading-view");
	saveAndShowList().catch((error) => {
		console.error("Failed to retry:", error);
		showView("error-view");
	});
});

saveAndShowList().catch((error) => {
	console.error("Failed to initialize popup:", error);
	showView("error-view");
});
