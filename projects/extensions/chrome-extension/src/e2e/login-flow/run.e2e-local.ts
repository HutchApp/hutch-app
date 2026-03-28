import { test } from "node:test";
import assert from "node:assert/strict";
import type http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { Builder, By } from "selenium-webdriver";
import { Options, ServiceBuilder, type Driver as ChromeDriver } from "selenium-webdriver/chrome";
import { FlowRunner, ExtensionStateHandler } from "browser-extension-core/e2e";
import {
	createSeleniumElementQueries,
	createSeleniumNavigation,
	createLoginActions,
	createSaveLinkActions,
	createPaginationActions,
	type PaginationProgress,
} from "browser-extension-core/e2e-actions";

const EXTENSION_DIR = path.resolve(__dirname, "../../../dist-extension-compiled");
const CFT_PATH_FILE = path.resolve(__dirname, "../../../.cache/chrome/binary-path");
const CFT_DRIVER_PATH_FILE = path.resolve(__dirname, "../../../.cache/chrome/driver-path");

const TEST_EMAIL = "e2e-test@example.com";
const TEST_PASSWORD = "testpassword123";
const TEST_PORT = 3001;

const TEST_LINK_URL = "https://example.com/test-article";
const TEST_LINK_TITLE = "Test Article";

async function startTestServer(): Promise<http.Server> {
	const { createTestApp } = await import("hutch/test-app");
	const { app, auth } = createTestApp();
	await auth.createUser({ email: TEST_EMAIL, password: TEST_PASSWORD });

	return new Promise((resolve) => {
		const server = app.listen(TEST_PORT, "127.0.0.1", () => {
			resolve(server);
		});
	});
}

async function discoverExtensionId(driver: ChromeDriver): Promise<string> {
	// Service worker may take time to register in headless mode
	const timeout = 15_000;
	const interval = 500;
	const deadline = Date.now() + timeout;

	while (Date.now() < deadline) {
		const targets = (await (driver as unknown as {
			sendAndGetDevToolsCommand(cmd: string, params: Record<string, unknown>): Promise<unknown>;
		}).sendAndGetDevToolsCommand(
			"Target.getTargets",
			{},
		)) as { targetInfos: Array<{ type: string; url: string }> };

		const swTarget = targets.targetInfos.find(
			(t) =>
				t.type === "service_worker" &&
				t.url.startsWith("chrome-extension://"),
		);

		if (swTarget) {
			const match = swTarget.url.match(/chrome-extension:\/\/([a-z]+)\//);
			assert.ok(match, "Could not extract extension ID from service worker URL");
			return match[1];
		}

		await new Promise((r) => setTimeout(r, interval));
	}

	throw new Error("Could not find extension service worker target within 15s");
}

// CI resource contention (parallel NX tasks) crashes Chrome intermittently.
// Retry the full test since the crash can happen at any point mid-execution.
const MAX_ATTEMPTS = 3;
test("should complete OAuth login flow, save links, and paginate the list", async () => {
	const server = await startTestServer();
	try {
		for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
			try {
				await runTest();
				return;
			} catch (err) {
				const isChromeExit = err instanceof Error && (
					err.message.includes("ECONNREFUSED") || err.message.includes("Chrome instance exited")
				);
				if (!isChromeExit || attempt === MAX_ATTEMPTS) throw err;
			}
		}
	} finally {
		server.close();
	}
});

async function runTest() {

	const options = new Options();
	if (process.env.HEADLESS !== "false") {
		options.addArguments("--headless=new");
	}
	options.addArguments(`--load-extension=${EXTENSION_DIR}`);
	options.addArguments("--disable-search-engine-choice-screen");
	options.addArguments("--no-sandbox"); // CI container has no user namespace; without this Chrome exits immediately
	options.addArguments("--disable-dev-shm-usage"); // CI runners have a small /dev/shm partition; without this Chrome crashes with ECONNREFUSED
	options.addArguments("--disable-gpu"); // CI runners have no GPU drivers; the GPU process crashes intermittently in headless mode

	// Chrome 137+ removed --load-extension in branded Google Chrome.
	// Use Chrome for Testing which still supports it.
	options.setChromeBinaryPath(
		fs.readFileSync(CFT_PATH_FILE, "utf8").trim(),
	);

	const serviceBuilder = new ServiceBuilder(
		fs.readFileSync(CFT_DRIVER_PATH_FILE, "utf8").trim(),
	);

	const driver = (await new Builder()
		.forBrowser("chrome")
		.setChromeOptions(options)
		.setChromeService(serviceBuilder)
		.build()) as ChromeDriver;

	try {
		const extensionId = await discoverExtensionId(driver);
		const POPUP_URL = `chrome-extension://${extensionId}/popup/popup.template.html`;

		await driver.get(POPUP_URL);

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

		const saveLinkProgress = { linkSaved: false, listVerified: false };
		const paginationProgress: PaginationProgress = {
			paginationLinksAdded: false,
			verifiedPage1: false,
			navigatedToPage2: false,
			verifiedPage2: false,
			navigatedBackToPage1: false,
			verifiedBackOnPage1: false,
		};

		const loginActions = createLoginActions({
			testEmail: TEST_EMAIL,
			testPassword: TEST_PASSWORD,
			popupWindowHandle,
		});

		const saveLinkActions = createSaveLinkActions({
			popupUrl: POPUP_URL,
			testUrl: TEST_LINK_URL,
			testTitle: TEST_LINK_TITLE,
			popupWindowHandle,
			progress: saveLinkProgress,
		});

		const paginationActions = createPaginationActions({
			popupUrl: POPUP_URL,
			saveLinkProgress,
			progress: paginationProgress,
		});

		const allActions = new Map([...loginActions, ...saveLinkActions, ...paginationActions]);

		const stateHandler = new ExtensionStateHandler(
			driver,
			async () => paginationProgress.verifiedBackOnPage1,
			allActions,
			createSeleniumElementQueries(),
		);

		const flowRunner = new FlowRunner(
			driver,
			stateHandler,
			createSeleniumNavigation(),
		);
		const result = await flowRunner.run(POPUP_URL, {
			maxSteps: 40,
		});

		assert.equal(result.success, true, `Flow failed: ${result.error}`);
		assert.equal(saveLinkProgress.linkSaved, true, "Link should have been saved");
		assert.equal(saveLinkProgress.listVerified, true, "Link should have been verified in list");
		assert.equal(paginationProgress.verifiedBackOnPage1, true, "Pagination should have been verified");
	} finally {
		await driver.quit();
	}
}
