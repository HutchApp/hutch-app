import { By, until } from "selenium-webdriver";
import type { WebDriver } from "selenium-webdriver";
import type { FlowAction } from "../test-framework/flow-state-handler.types";

export function createLoginActions(config: {
	testEmail: string;
	testPassword: string;
	popupWindowHandle: string;
}): Map<string, FlowAction> {
	const actions = new Map<string, FlowAction>();

	actions.set("click-login", {
		async isAvailable(driver: WebDriver): Promise<boolean> {
			try {
				const button = await driver.findElement(By.id("login-button"));
				return button.isDisplayed();
			} catch {
				return false;
			}
		},
		async execute(driver: WebDriver): Promise<void> {
			const button = await driver.findElement(By.id("login-button"));
			await button.click();
		},
	});

	actions.set("switch-to-login-tab", {
		async isAvailable(driver: WebDriver): Promise<boolean> {
			const handles = await driver.getAllWindowHandles();
			return handles.length > 1;
		},
		async execute(driver: WebDriver): Promise<void> {
			const handles = await driver.getAllWindowHandles();
			const newTab = handles.find((h) => h !== config.popupWindowHandle);
			if (!newTab) throw new Error("No new tab found for login");
			await driver.switchTo().window(newTab);
			await driver.wait(until.elementLocated(By.id("email")), 10000);
		},
	});

	actions.set("submit-login-form", {
		async isAvailable(driver: WebDriver): Promise<boolean> {
			try {
				const emailInput = await driver.findElement(By.id("email"));
				return emailInput.isDisplayed();
			} catch {
				return false;
			}
		},
		async execute(driver: WebDriver): Promise<void> {
			const emailInput = await driver.findElement(By.id("email"));
			await emailInput.clear();
			await emailInput.sendKeys(config.testEmail);
			const passwordInput = await driver.findElement(By.id("password"));
			await passwordInput.clear();
			await passwordInput.sendKeys(config.testPassword);
			const submitButton = await driver.findElement(
				By.css('button[type="submit"]'),
			);
			await submitButton.click();
		},
	});

	actions.set("approve-oauth", {
		async isAvailable(driver: WebDriver): Promise<boolean> {
			try {
				const button = await driver.findElement(
					By.css('button[value="approve"]'),
				);
				return button.isDisplayed();
			} catch {
				return false;
			}
		},
		async execute(driver: WebDriver): Promise<void> {
			const button = await driver.findElement(
				By.css('button[value="approve"]'),
			);
			await button.click();
		},
	});

	actions.set("switch-to-popup", {
		async isAvailable(driver: WebDriver): Promise<boolean> {
			try {
				const url = await driver.getCurrentUrl();
				return url.includes("/oauth/callback");
			} catch {
				return true;
			}
		},
		async execute(driver: WebDriver): Promise<void> {
			await driver.switchTo().window(config.popupWindowHandle);
		},
	});

	return actions;
}
