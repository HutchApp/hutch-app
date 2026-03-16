import type { Page, BrowserContext } from "playwright";
import type { FlowAction } from "../test-framework/flow-state-handler.types";

export function createLoginActions(config: {
	testEmail: string;
	testPassword: string;
	context: BrowserContext;
	getPopupPage: () => Page;
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
			return pages.length > 1;
		},
		async execute(_page: Page): Promise<void> {
			const pages = config.context.pages();
			const popupPage = config.getPopupPage();
			const newPage = pages.find((p) => p !== popupPage);
			if (!newPage) throw new Error("No new tab found for login");
			await newPage.waitForSelector("#email", { timeout: 10000 });
		},
	});

	actions.set("submit-login-form", {
		async isAvailable(page: Page): Promise<boolean> {
			const emailInput = await page.$("#email");
			if (!emailInput) return false;
			return emailInput.isVisible();
		},
		async execute(_page: Page): Promise<void> {
			const pages = config.context.pages();
			const popupPage = config.getPopupPage();
			const loginPage = pages.find((p) => p !== popupPage);
			if (!loginPage) throw new Error("No login page found");

			await loginPage.fill("#email", config.testEmail);
			await loginPage.fill("#password", config.testPassword);
			await loginPage.click('button[type="submit"]');
		},
	});

	actions.set("approve-oauth", {
		async isAvailable(page: Page): Promise<boolean> {
			const button = await page.$('button[value="approve"]');
			if (!button) return false;
			return button.isVisible();
		},
		async execute(_page: Page): Promise<void> {
			const pages = config.context.pages();
			const popupPage = config.getPopupPage();
			const authPage = pages.find((p) => p !== popupPage);
			if (!authPage) throw new Error("No auth page found");

			await authPage.click('button[value="approve"]');
		},
	});

	actions.set("switch-to-popup", {
		async isAvailable(_page: Page): Promise<boolean> {
			const pages = config.context.pages();
			const popupPage = config.getPopupPage();
			const otherPage = pages.find((p) => p !== popupPage);
			if (!otherPage) return true;
			try {
				const url = otherPage.url();
				return url.includes("/oauth/callback");
			} catch {
				return true;
			}
		},
		async execute(_page: Page): Promise<void> {
			const popupPage = config.getPopupPage();
			await popupPage.bringToFront();
		},
	});

	return actions;
}
