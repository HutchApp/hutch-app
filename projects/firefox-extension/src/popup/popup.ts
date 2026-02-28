import type { ReadingListItem, ReadingListItemId } from "../domain/reading-list-item.types";
import type { PopupMessage } from "../background/messages.types";
import type { GuardedResult } from "../providers/auth/auth.types";
import type { SaveUrlResult, RemoveUrlResult } from "../providers/reading-list/reading-list.types";
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

async function init() {
	const tabs = await browser.tabs.query({ active: true, currentWindow: true });
	const tab = tabs[0];
	if (!tab?.url) return;

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
		showView("already-saved-view");
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

document.getElementById("login-form")?.addEventListener("submit", async (e) => {
	e.preventDefault();
	const email = (document.getElementById("email") as HTMLInputElement).value;
	const password = (document.getElementById("password") as HTMLInputElement).value;

	const result = (await send({
		type: "login",
		email,
		password,
	})) as LoginResult;

	if (result.ok) {
		showView("loading-view");
		await init();
	} else {
		const errorEl = document.getElementById("login-error");
		if (errorEl) errorEl.hidden = false;
	}
});

document.getElementById("undo-button")?.addEventListener("click", async () => {
	if (!savedItemId) return;

	const result = (await send({
		type: "remove-item",
		id: savedItemId,
	})) as GuardedResult<RemoveUrlResult>;

	if (result.ok && result.value.ok) {
		showView("removed-view");
	}
});

init();
