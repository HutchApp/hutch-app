import assert from "node:assert/strict";
import { By, until } from "selenium-webdriver";
import type { WebDriver } from "selenium-webdriver";
import { CSS_SELECTORS, type FlowAction } from "browser-extension-core/e2e";

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
}): Map<string, FlowAction<WebDriver>> {
	const actions = new Map<string, FlowAction<WebDriver>>();

	actions.set("navigate-to-save-link", {
		async isAvailable(driver: WebDriver): Promise<boolean> {
			if (config.progress.linkSaved) return false;
			try {
				const loginView = await driver.findElement(By.id("login-view"));
				const loginHidden = await loginView.getAttribute("hidden");
				assert.notEqual(loginHidden, null, "login-view should be hidden after login");
				return true;
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
				const savedView = await driver.findElement(By.id("saved-view"));
				const hidden = await savedView.getAttribute("hidden");
				assert.equal(hidden, null, "saved-view should be visible");
				return true;
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
				const listView = await driver.findElement(By.id("list-view"));
				const hidden = await listView.getAttribute("hidden");
				assert.equal(hidden, null, "list-view should be visible");
				return true;
			} catch {
				return false;
			}
		},
		async execute(driver: WebDriver): Promise<void> {
			await driver.wait(
				until.elementLocated(By.css(CSS_SELECTORS.listItem)),
				15000,
			);
			const items = await driver.findElements(By.css(CSS_SELECTORS.listItem));
			const hrefs = await Promise.all(items.map(el => el.getAttribute("href")));
			const readUrlPattern = /\/queue\/[a-f0-9]+\/read$/;
			assert.ok(
				hrefs.some(href => href === config.testUrl || readUrlPattern.test(href)),
				`Expected "${config.testUrl}" or a read URL in list hrefs, but found: ${hrefs.join(", ")}`,
			);
			config.progress.listVerified = true;
		},
	});

	return actions;
}
