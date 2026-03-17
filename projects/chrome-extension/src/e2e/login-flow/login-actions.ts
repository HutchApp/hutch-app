import type { Page, BrowserContext } from "playwright";
import type { FlowAction } from "../test-framework/flow-state-handler.types";

export function createLoginActions(config: {
	testEmail: string;
	testPassword: string;
	context: BrowserContext;
	getPopupPage: () => Page;
	setActivePage: (page: Page) => void;
}): Map<string, FlowAction> {
	const actions = new Map<string, FlowAction>();

	actions.set("click-login", {
		async isAvailable(page: Page): Promise<boolean> {
			const button = await page.$("#login-button");
			if (!button) return false;
			return button.isVisible();
		},
		async execute(page: Page): Promise<void> {
			await page.click("#login-button");
		},
	});

	actions.set("switch-to-login-tab", {
		async isAvailable(_page: Page): Promise<boolean> {
			const pages = config.context.pages();
			const popupPage = config.getPopupPage();
			return pages.some((p) => p !== popupPage && !p.url().startsWith("about:"));
		},
		async execute(_page: Page): Promise<void> {
			const pages = config.context.pages();
			const popupPage = config.getPopupPage();
			const newPage = pages.find((p) => p !== popupPage && !p.url().startsWith("about:"));
			if (!newPage) throw new Error("No new tab found for login");
			await newPage.waitForSelector("#email", { timeout: 10000 });
			config.setActivePage(newPage);
		},
	});

	actions.set("submit-login-form", {
		async isAvailable(page: Page): Promise<boolean> {
			const emailInput = await page.$("#email");
			if (!emailInput) return false;
			return emailInput.isVisible();
		},
		async execute(page: Page): Promise<void> {
			await page.fill("#email", config.testEmail);
			await page.fill("#password", config.testPassword);
			await page.click('button[type="submit"]');
		},
	});

	actions.set("approve-oauth", {
		async isAvailable(page: Page): Promise<boolean> {
			const button = await page.$('button[value="approve"]');
			if (!button) return false;
			return button.isVisible();
		},
		async execute(page: Page): Promise<void> {
			await page.click('button[value="approve"]');
		},
	});

	actions.set("switch-to-popup", {
		async isAvailable(page: Page): Promise<boolean> {
			try {
				const url = page.url();
				return url.includes("/oauth/callback");
			} catch {
				return true;
			}
		},
		async execute(_page: Page): Promise<void> {
			const popupPage = config.getPopupPage();
			config.setActivePage(popupPage);
			await popupPage.reload({ waitUntil: "domcontentloaded" });
		},
	});

	return actions;
}
