import { By } from "selenium-webdriver";
import type { WebDriver } from "selenium-webdriver";
import {
	stateChanged,
	type ElementQueries,
	type DriverNavigation,
} from "../e2e";

export function createSeleniumElementQueries(): ElementQueries<WebDriver> {
	return {
		findVisibleViewById: async (driver, viewId) => {
			try {
				const element = await driver.findElement(By.id(viewId));
				const hidden = await element.getAttribute("hidden");
				return hidden === null;
			} catch {
				return false;
			}
		},
		hasBodyClass: async (driver, className) => {
			try {
				await driver.findElement(By.css(`body.${className}`));
				return true;
			} catch {
				return false;
			}
		},
		isWindowClosed: async (driver) => {
			try {
				await driver.getCurrentUrl();
				return false;
			} catch (error) {
				if (
					error instanceof Error &&
					error.name === "NoSuchWindowError"
				) {
					return true;
				}
				throw error;
			}
		},
	};
}

export function createSeleniumNavigation(): DriverNavigation<WebDriver> {
	return {
		navigateTo: async (driver, url) => {
			await driver.get(url);
		},
		waitForStateChange: async (driver, previous, detectCurrentState) => {
			await driver.wait(async () => {
				const newState = await detectCurrentState();
				return stateChanged(previous, newState);
			}, 10000);
		},
	};
}
