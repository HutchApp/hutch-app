import { By } from "selenium-webdriver";
import type { FlowAction } from "../test-framework/flow-state-handler.types";

export function createLoginActions(): Map<string, FlowAction> {
	const actions = new Map<string, FlowAction>();

	actions.set("click-login", {
		isAvailable: async (driver) => {
			const button = await driver.findElement(By.id("login-button"));
			return button.isDisplayed();
		},
		execute: async (driver) => {
			const button = await driver.findElement(By.id("login-button"));
			await button.click();
		},
	});

	return actions;
}
