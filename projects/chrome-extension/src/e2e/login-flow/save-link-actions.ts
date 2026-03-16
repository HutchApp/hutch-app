import assert from "node:assert/strict";
import type { Page } from "playwright";
import type { FlowAction } from "../test-framework/flow-state-handler.types";

interface SaveLinkProgress {
	linkSaved: boolean;
	listVerified: boolean;
}

export function createSaveLinkActions(config: {
	popupUrl: string;
	testUrl: string;
	testTitle: string;
	progress: SaveLinkProgress;
	getPopupPage: () => Page;
}): Map<string, FlowAction> {
	const actions = new Map<string, FlowAction>();

	actions.set("navigate-to-save-link", {
		async isAvailable(page: Page): Promise<boolean> {
			if (config.progress.linkSaved) return false;
			try {
				const loginView = await page.$("#login-view");
				if (!loginView) return false;
				const loginHidden = await loginView.getAttribute("hidden");
				assert.notEqual(loginHidden, null, "login-view should be hidden after login");
				return true;
			} catch {
				return false;
			}
		},
		async execute(_page: Page): Promise<void> {
			const popupPage = config.getPopupPage();
			const saveUrl = `${config.popupUrl}?url=${encodeURIComponent(config.testUrl)}&title=${encodeURIComponent(config.testTitle)}`;
			await popupPage.goto(saveUrl);
			await popupPage.waitForFunction(() => {
				const savedView = document.getElementById("saved-view");
				const listView = document.getElementById("list-view");
				if (savedView && savedView.getAttribute("hidden") === null) return true;
				if (listView && listView.getAttribute("hidden") === null) return true;
				return false;
			}, { timeout: 15000 });
			config.progress.linkSaved = true;
		},
	});

	actions.set("navigate-to-list-after-save", {
		async isAvailable(page: Page): Promise<boolean> {
			if (!config.progress.linkSaved) return false;
			if (config.progress.listVerified) return false;
			try {
				const savedView = await page.$("#saved-view");
				if (!savedView) return false;
				const hidden = await savedView.getAttribute("hidden");
				assert.equal(hidden, null, "saved-view should be visible");
				return true;
			} catch {
				return false;
			}
		},
		async execute(_page: Page): Promise<void> {
			const popupPage = config.getPopupPage();
			await popupPage.goto(config.popupUrl);
			await popupPage.waitForFunction(() => {
				const listView = document.getElementById("list-view");
				return listView && listView.getAttribute("hidden") === null;
			}, { timeout: 15000 });
		},
	});

	actions.set("verify-link-in-list", {
		async isAvailable(page: Page): Promise<boolean> {
			if (!config.progress.linkSaved) return false;
			if (config.progress.listVerified) return false;
			try {
				const listView = await page.$("#list-view");
				if (!listView) return false;
				const hidden = await listView.getAttribute("hidden");
				assert.equal(hidden, null, "list-view should be visible");
				return true;
			} catch {
				return false;
			}
		},
		async execute(_page: Page): Promise<void> {
			const popupPage = config.getPopupPage();
			await popupPage.waitForSelector("#link-list .list-view__item", { timeout: 15000 });
			const hrefs = await popupPage.$$eval(
				"#link-list .list-view__item-title",
				(elements) => elements.map((el) => el.getAttribute("href")),
			);
			assert.ok(
				hrefs.some((href) => href === config.testUrl),
				`Expected "${config.testUrl}" in list hrefs, but found: ${hrefs.join(", ")}`,
			);
			config.progress.listVerified = true;
		},
	});

	return actions;
}
