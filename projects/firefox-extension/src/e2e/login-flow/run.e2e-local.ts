import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { Builder, By } from "selenium-webdriver";
import { Options } from "selenium-webdriver/firefox";
import { FlowRunner } from "../test-framework/flow-runner";
import { LoginFlowStateHandler } from "./navigation-handler";

const ADDON_ID = "hutch-extension@hutch-app.com";
const ADDON_UUID = "d3b07384-d113-4ec6-a7b8-5f7e3b4c9a12";
const EXTENSION_DIR = path.resolve(__dirname, "../../../dist-extension-compiled");
const POPUP_URL = `moz-extension://${ADDON_UUID}/popup/popup.template.html`;

test("should show login view when not authenticated", async () => {
	const options = new Options();
  if (process.env.HEADLESS !== "false") {
    options.addArguments( "--headless");
  }
	options.setPreference(
		"extensions.webextensions.uuids",
		JSON.stringify({ [ADDON_ID]: ADDON_UUID }),
	);

	const driver = await new Builder()
		.forBrowser("firefox")
		.setFirefoxOptions(options)
		.build();

	try {
		await (
			driver as unknown as {
				installAddon: (
					path: string,
					temporary: boolean,
				) => Promise<void>;
			}
		).installAddon(EXTENSION_DIR, true);

		const stateHandler = new LoginFlowStateHandler(
			driver,
			async (d) => {
				const loginButton = await d.findElement(By.id("login-button"));
				return loginButton.isDisplayed();
			},
			new Map(),
		);

		const flowRunner = new FlowRunner(driver, stateHandler);
		const result = await flowRunner.run(POPUP_URL, { maxSteps: 5, actionDelayMs: 2000 });

		assert.equal(result.success, true, `Flow failed: ${result.error}`);
		assert.equal(
			result.currentState.activeView,
			"login-view",
			`Expected login-view, got ${result.currentState.activeView}`,
		);
	} finally {
		await driver.quit();
	}
});
