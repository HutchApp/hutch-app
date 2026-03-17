import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import type http from "node:http";
import { chromium } from "playwright";
import { FlowRunner } from "../test-framework/flow-runner";
import { LoginFlowStateHandler } from "./navigation-handler";
import { createLoginActions } from "./login-actions";
import { createSaveLinkActions } from "./save-link-actions";

const EXTENSION_DIR = path.resolve(__dirname, "../../../dist-extension-compiled");

const TEST_EMAIL = "e2e-test@example.com";
const TEST_PASSWORD = "testpassword123";
const TEST_PORT = 3000;

const TEST_LINK_URL = "https://example.com/test-article";
const TEST_LINK_TITLE = "Test Article";

async function startTestServer(): Promise<http.Server> {
	const hutchTestApp = path.resolve(
		__dirname,
		"../../../../hutch/dist/runtime/test-app",
	);
	const { createTestApp } = await import(hutchTestApp);
	const { app, auth } = createTestApp();
	await auth.createUser({ email: TEST_EMAIL, password: TEST_PASSWORD });

	return new Promise((resolve) => {
		const server = app.listen(TEST_PORT, "127.0.0.1", () => {
			resolve(server);
		});
	});
}

test("should complete OAuth login flow and save a link to the list", async () => {
	const server = await startTestServer();

	const headless = process.env.HEADLESS !== "false";

	const context = await chromium.launchPersistentContext("", {
		headless,
		channel: "chromium",
		args: [
			`--disable-extensions-except=${EXTENSION_DIR}`,
			`--load-extension=${EXTENSION_DIR}`,
			"--no-first-run",
			"--disable-default-apps",
		],
	});

	try {
		// Chrome extensions get a unique ID at load time — discover it from
		// the service worker URL registered by the background script
		let serviceWorker = context.serviceWorkers()[0];
		if (!serviceWorker) {
			serviceWorker = await context.waitForEvent("serviceworker");
		}
		const extensionId = serviceWorker.url().split("/")[2];

		const popupUrl = `chrome-extension://${extensionId}/popup/popup.template.html`;

		const page = await context.newPage();
		await page.goto(popupUrl);

		await page.waitForFunction(() => {
			const el = document.getElementById("login-view");
			return el && el.getAttribute("hidden") === null;
		}, { timeout: 10000 });

		let activePage = page;
		const getActivePage = () => activePage;
		const setActivePage = (p: typeof page) => { activePage = p; };

		const saveLinkProgress = { linkSaved: false, listVerified: false };

		const loginActions = createLoginActions({
			testEmail: TEST_EMAIL,
			testPassword: TEST_PASSWORD,
			context,
			getPopupPage: () => page,
			setActivePage,
		});

		const saveLinkActions = createSaveLinkActions({
			popupUrl,
			testUrl: TEST_LINK_URL,
			testTitle: TEST_LINK_TITLE,
			progress: saveLinkProgress,
			getPopupPage: () => page,
		});

		const allActions = new Map([...loginActions, ...saveLinkActions]);

		const stateHandler = new LoginFlowStateHandler(
			getActivePage,
			async () => saveLinkProgress.listVerified,
			allActions,
		);

		const flowRunner = new FlowRunner(page, stateHandler);
		const result = await flowRunner.run(popupUrl, {
			maxSteps: 25,
		});

		assert.equal(result.success, true, `Flow failed: ${result.error}`);
		assert.equal(saveLinkProgress.linkSaved, true, "Link should have been saved");
		assert.equal(saveLinkProgress.listVerified, true, "Link should have been verified in list");
	} finally {
		await context.close();
		server.close();
	}
});
