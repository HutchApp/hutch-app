import type {
	ReadingListItem,
	PopupMessage,
	GuardedResult,
	SaveUrlResult,
	RemoveUrlResult,
} from "browser-extension-core";
import { filterByUrl, paginateItems } from "browser-extension-core";
import { HutchLogger, consoleLogger } from "@packages/hutch-logger";

const logger = HutchLogger.from(consoleLogger);

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

let allItems: ReadingListItem[] = [];
let currentPage = 1;

const AVATAR_COLORS = [
	"#6366F1",
	"#8B5CF6",
	"#EC4899",
	"#F59E0B",
	"#10B981",
	"#3B82F6",
	"#EF4444",
	"#14B8A6",
	"#F97316",
	"#06B6D4",
];

function avatarColor(domain: string): string {
	let hash = 0;
	for (let i = 0; i < domain.length; i++) {
		hash = (hash * 31 + domain.charCodeAt(i)) | 0;
	}
	return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function relativeTime(date: Date): string {
	const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
	if (seconds < 60) return "just now";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days === 1) return "Yesterday";
	if (days < 30) return `${days}d ago`;
	const months = Math.floor(days / 30);
	if (months < 12) return `${months}mo ago`;
	return `${Math.floor(months / 12)}y ago`;
}

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

		let hostname: string;
		try {
			hostname = new URL(item.url).hostname;
		} catch {
			hostname = item.url;
		}

		const avatar = document.createElement("div");
		avatar.className = "list-view__avatar";
		avatar.textContent = hostname.charAt(0);
		avatar.style.backgroundColor = avatarColor(hostname);

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
		domain.textContent = hostname;

		textContainer.appendChild(link);
		textContainer.appendChild(domain);

		const time = document.createElement("span");
		time.className = "list-view__time";
		time.textContent = relativeTime(new Date(item.savedAt));

		const deleteButton = document.createElement("button");
		deleteButton.className = "list-view__delete";
		deleteButton.textContent = "\u00D7";
		deleteButton.title = "Remove from list";
		deleteButton.addEventListener("click", async () => {
			const result = (await send({
				type: "remove-item",
				id: item.id,
			})) as GuardedResult<RemoveUrlResult>;

			if (result.ok && result.value.ok) {
				allItems = allItems.filter((i) => i.id !== item.id);
				renderLinks(filterItems());
			}
		});

		div.appendChild(avatar);
		div.appendChild(textContainer);
		div.appendChild(time);
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
}

async function showListView() {
	showView("list-view");
	await loadAllItems();
}

async function getActiveTab(): Promise<{ url: string; title: string } | null> {
	const params = new URLSearchParams(window.location.search);
	const paramUrl = params.get("url");
	if (paramUrl) return { url: paramUrl, title: params.get("title") ?? paramUrl };

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
		showView("saved-view");
	}
}

document.getElementById("login-button")?.addEventListener("click", async () => {
	const loginError = document.getElementById("login-error");
	if (loginError) loginError.hidden = true;

	try {
		const result = (await send({ type: "login" })) as {
			ok: boolean;
			reason?: string;
			error?: { message?: string };
		};
		if (!result.ok) {
			if (loginError) {
				loginError.textContent = `Login failed: ${result.reason ?? "unknown"} — ${result.error?.message ?? ""}`;
				loginError.hidden = false;
			}
			return;
		}
	} catch (err) {
		if (loginError) {
			loginError.textContent = `Login error: ${err instanceof Error ? err.message : String(err)}`;
			loginError.hidden = false;
		}
		return;
	}

	showView("loading-view");
	await saveAndShowList();
});

document
	.getElementById("view-queue-button")
	?.addEventListener("click", async () => {
		await showListView();
	});

document
	.getElementById("logout-button")
	?.addEventListener("click", async () => {
		await send({ type: "logout" });
		showView("login-view");
	});

document.getElementById("filter-input")?.addEventListener("input", () => {
	currentPage = 1;
	renderLinks(filterItems());
});

const shortcutHint = document.querySelector(".shortcut-hint");
if (shortcutHint) {
	// navigator.platform is deprecated but navigator.userAgentData is not
	// supported in Firefox, so this is the best available approach
	const isMac = navigator.platform.startsWith("Mac");
	if (isMac) {
		shortcutHint.textContent = "";
		const prefix = document.createTextNode("Tip: Use ");
		const cmdKey = document.createElement("kbd");
		cmdKey.textContent = "\u2318";
		const plus = document.createTextNode("+");
		const dKey = document.createElement("kbd");
		dKey.textContent = "D";
		const suffix = document.createTextNode(" to save from any page");
		shortcutHint.append(prefix, cmdKey, plus, dKey, suffix);
	}
}

saveAndShowList().catch((error) => {
	logger.error("Failed to initialize popup:", error);
	showView("list-view");
	const listError = document.getElementById("list-error");
	if (listError) listError.hidden = false;
});
