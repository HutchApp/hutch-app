import type { ReadingListItem } from "extension-core/domain/reading-list-item.types";
import type { SendPopupMessage } from "extension-core/background/messages.types";
import { initPopupFlow, type PopupView } from "extension-core/popup/popup-flow";

function showView(id: string) {
	for (const view of document.querySelectorAll(".view")) {
		(view as HTMLElement).hidden = true;
	}
	const target = document.getElementById(id);
	if (target) target.hidden = false;
}

// browser.runtime.sendMessage returns Promise<unknown> per WebExtension API
const send = ((message) => browser.runtime.sendMessage(message)) as SendPopupMessage;

async function getActiveTab(): Promise<{ url: string; title: string } | null> {
	const params = new URLSearchParams(window.location.search);
	const paramUrl = params.get("url");
	if (paramUrl) return { url: paramUrl, title: params.get("title") ?? paramUrl };

	const tabs = await browser.tabs.query({ active: true, currentWindow: true });
	const tab = tabs[0];
	if (!tab?.url) return null;
	return { url: tab.url, title: tab.title ?? tab.url };
}

const flow = initPopupFlow({ sendMessage: send, getActiveTab });

function renderPagination(totalPages: number, visiblePages: number[], currentPage: number) {
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
		renderView(flow.goToPage(currentPage - 1));
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
			renderView(flow.goToPage(page));
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
		renderView(flow.goToPage(currentPage + 1));
	});
	pagination.appendChild(nextButton);
}

function renderLinks(items: ReadingListItem[], totalPages: number, visiblePages: number[], currentPage: number, isEmpty: boolean) {
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

	if (isEmpty) {
		emptyList.hidden = false;
		renderPagination(1, [1], 1);
		return;
	}

	if (items.length === 0) {
		noMatches.hidden = false;
		renderPagination(1, [1], 1);
		return;
	}

	for (const item of items) {
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
			renderView(await flow.removeItem(item.id));
		});

		div.appendChild(textContainer);
		div.appendChild(deleteButton);
		linkList.appendChild(div);
	}

	renderPagination(totalPages, visiblePages, currentPage);
}

function renderView(view: PopupView) {
	switch (view.view) {
		case "loading":
			showView("loading-view");
			break;
		case "login":
			showView("login-view");
			break;
		case "saved":
			showView("saved-view");
			break;
		case "list":
			showView("list-view");
			renderLinks(view.items, view.totalPages, view.visiblePages, view.page, view.totalPages === 1 && view.items.length === 0);
			break;
		case "error":
			showView("list-view");
			{
				const listError = document.getElementById("list-error");
				if (listError) listError.hidden = false;
			}
			break;
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

		const result = await flow.login({ email, password });

		if (result.view === "login") {
			const errorEl = document.getElementById("login-error");
			if (errorEl) errorEl.hidden = false;
		} else {
			renderView(result);
		}
	});

document
	.getElementById("undo-button")
	?.addEventListener("click", async () => {
		renderView(await flow.undo());
	});

document
	.getElementById("reload-button")
	?.addEventListener("click", async () => {
		renderView(await flow.reload());
	});

document
	.getElementById("logout-button")
	?.addEventListener("click", async () => {
		renderView(await flow.logout());
	});

document.getElementById("filter-input")?.addEventListener("input", () => {
	const filterInput = document.getElementById("filter-input") as HTMLInputElement;
	renderView(flow.filter(filterInput.value));
});

flow.start()
	.then(renderView)
	.catch((error) => {
		console.error("Failed to initialize popup:", error);
		renderView({ view: "error" });
	});
