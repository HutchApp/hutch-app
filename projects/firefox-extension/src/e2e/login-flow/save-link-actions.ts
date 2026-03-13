import { By, until } from "selenium-webdriver";
import type { WebDriver } from "selenium-webdriver";
import type { FlowAction } from "../test-framework/flow-state-handler.types";

interface SaveLinkProgress {
	linkSaved: boolean;
	listVerified: boolean;
}

export function createSaveLinkActions(config: {
	popupUrl: string;
	testUrl: string;
	testTitle: string;
	popupWindowHandle: string;
	progress: SaveLinkProgress;
}): Map<string, FlowAction> {
	const actions = new Map<string, FlowAction>();

	actions.set("navigate-to-save-link", {
		async isAvailable(driver: WebDriver): Promise<boolean> {
			if (config.progress.linkSaved) return false;
			try {
				const url = await driver.getCurrentUrl();
				if (!url.startsWith("moz-extension://")) return false;
				const loginView = await driver.findElement(By.id("login-view"));
				const loginHidden = await loginView.getAttribute("hidden");
				return loginHidden !== null;
			} catch {
				return false;
			}
		},
		async execute(driver: WebDriver): Promise<void> {
			const saveUrl = `${config.popupUrl}?url=${encodeURIComponent(config.testUrl)}&title=${encodeURIComponent(config.testTitle)}`;
			await driver.get(saveUrl);
			await driver.wait(async () => {
				try {
					const savedView = await driver.findElement(By.id("saved-view"));
					const savedHidden = await savedView.getAttribute("hidden");
					if (savedHidden === null) return true;
					const listView = await driver.findElement(By.id("list-view"));
					const listHidden = await listView.getAttribute("hidden");
					return listHidden === null;
				} catch {
					return false;
				}
			}, 15000);
			config.progress.linkSaved = true;
		},
	});

	actions.set("navigate-to-list-after-save", {
		async isAvailable(driver: WebDriver): Promise<boolean> {
			if (!config.progress.linkSaved) return false;
			if (config.progress.listVerified) return false;
			try {
				const url = await driver.getCurrentUrl();
				if (!url.startsWith("moz-extension://")) return false;
				const savedView = await driver.findElement(By.id("saved-view"));
				const hidden = await savedView.getAttribute("hidden");
				return hidden === null;
			} catch {
				return false;
			}
		},
		async execute(driver: WebDriver): Promise<void> {
			await driver.get(config.popupUrl);
			await driver.wait(async () => {
				try {
					const listView = await driver.findElement(By.id("list-view"));
					const hidden = await listView.getAttribute("hidden");
					return hidden === null;
				} catch {
					return false;
				}
			}, 15000);
		},
	});

	actions.set("verify-link-in-list", {
		async isAvailable(driver: WebDriver): Promise<boolean> {
			if (!config.progress.linkSaved) return false;
			if (config.progress.listVerified) return false;
			try {
				const url = await driver.getCurrentUrl();
				if (!url.startsWith("moz-extension://")) return false;
				const listView = await driver.findElement(By.id("list-view"));
				const hidden = await listView.getAttribute("hidden");
				return hidden === null;
			} catch {
				return false;
			}
		},
		async execute(driver: WebDriver): Promise<void> {
			await driver.wait(
				until.elementLocated(By.css("#link-list .list-view__item")),
				15000,
			);
			const items = await driver.findElements(By.css("#link-list .list-view__item-title"));
			const titles = await Promise.all(items.map(el => el.getText()));
			const found = titles.some(t => t.includes("Article from"));
			if (!found) {
				throw new Error(`Expected saved link in list, but found: ${titles.join(", ")}`);
			}
			config.progress.listVerified = true;
		},
	});

	return actions;
}
