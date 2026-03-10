import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import type http from "node:http";
import { Builder, By } from "selenium-webdriver";
import { Options } from "selenium-webdriver/firefox";
import { FlowRunner } from "../test-framework/flow-runner";
import { LoginFlowStateHandler } from "./navigation-handler";
import { createLoginActions } from "./login-actions";

const ADDON_ID = "hutch-extension@hutch-app.com";
const ADDON_UUID = "d3b07384-d113-4ec6-a7b8-5f7e3b4c9a12";
const EXTENSION_DIR = path.resolve(__dirname, "../../../dist-extension-compiled");
const POPUP_URL = `moz-extension://${ADDON_UUID}/popup/popup.template.html`;

const TEST_EMAIL = "e2e-test@example.com";
const TEST_PASSWORD = "testpassword123";

async function startTestServer(): Promise<{ server: http.Server; port: number }> {
	const hutchTestApp = path.resolve(
		__dirname,
		"../../../../hutch/dist/runtime/test-app",
	);
	const { createTestApp } = await import(hutchTestApp);
	const { app, auth } = createTestApp();
	await auth.createUser({ email: TEST_EMAIL, password: TEST_PASSWORD });

	return new Promise((resolve) => {
		const server = app.listen(0, "127.0.0.1", () => {
			const addr = server.address() as { port: number };
			resolve({ server, port: addr.port });
		});
	});
}

test("should complete OAuth login flow", async () => {
	const { server, port } = await startTestServer();
	const serverUrl = `http://127.0.0.1:${port}`;

	const options = new Options();
	if (process.env.HEADLESS !== "false") {
		options.addArguments("--headless");
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

		// Configure the extension to use our test server
		await driver.get(POPUP_URL);
		await driver.executeScript(
			`browser.storage.local.set({ hutch_server_url: "${serverUrl}" });`,
		);

		// Wait for storage to be set, then reload the popup
		await driver.sleep(500);
		await driver.get(POPUP_URL);

		// Wait for login-view to appear
		await driver.wait(async () => {
			try {
				const el = await driver.findElement(By.id("login-view"));
				const hidden = await el.getAttribute("hidden");
				return hidden === null;
			} catch {
				return false;
			}
		}, 10000);

		const popupWindowHandle = await driver.getWindowHandle();

		const loginActions = createLoginActions({
			testEmail: TEST_EMAIL,
			testPassword: TEST_PASSWORD,
			popupWindowHandle,
		});

		const stateHandler = new LoginFlowStateHandler(
			driver,
			async (d) => {
				// After switching back to popup, check that we're no longer on login-view
				const url = await d.getCurrentUrl();
				if (!url.startsWith("moz-extension://")) return false;

				try {
					const loginView = await d.findElement(By.id("login-view"));
					const hidden = await loginView.getAttribute("hidden");
					return hidden !== null;
				} catch {
					return false;
				}
			},
			loginActions,
		);

		const flowRunner = new FlowRunner(driver, stateHandler);
		const result = await flowRunner.run(POPUP_URL, {
			maxSteps: 15,
			actionDelayMs: 1000,
		});

		assert.equal(result.success, true, `Flow failed: ${result.error}`);
	} finally {
		await driver.quit();
		server.close();
	}
});
