import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { WebDriver } from "selenium-webdriver";
import { LoginFlowStateHandler } from "./navigation-handler";
import type { FlowAction } from "../test-framework/flow-state-handler.types";

function createTestDriver(getAttributeValue: string | null, currentUrl = "moz-extension://test/popup.html"): WebDriver {
	return {
		findElement: async () => ({
			getAttribute: async () => getAttributeValue,
		}),
		getCurrentUrl: async () => currentUrl,
	} as unknown as WebDriver;
}

describe("LoginFlowStateHandler", () => {
	it("returns transitioning view when no visible view is found", async () => {
		const driver = createTestDriver("true");
		const handler = new LoginFlowStateHandler(
			driver,
			async () => false,
			new Map(),
		);

		const state = await handler.detectCurrentState();
		assert.equal(state.activeView, "transitioning");
	});

	it("throws when executing an unknown action", async () => {
		const driver = createTestDriver(null);
		const handler = new LoginFlowStateHandler(
			driver,
			async () => false,
			new Map(),
		);

		await assert.rejects(() => handler.executeAction("nonexistent"), {
			message: "Action 'nonexistent' not found",
		});
	});

	it("excludes unavailable actions from state", async () => {
		const driver = createTestDriver(null);
		const unavailableAction: FlowAction = {
			isAvailable: async () => false,
			execute: async () => {},
		};

		const handler = new LoginFlowStateHandler(
			driver,
			async () => false,
			new Map([["unavailable-action", unavailableAction]]),
		);

		const state = await handler.detectCurrentState();
		assert.deepEqual(state.availableActions, []);
	});

	it("includes available actions in state", async () => {
		const driver = createTestDriver(null);
		const availableAction: FlowAction = {
			isAvailable: async () => true,
			execute: async () => {},
		};

		const handler = new LoginFlowStateHandler(
			driver,
			async () => false,
			new Map([["click-login", availableAction]]),
		);

		const state = await handler.detectCurrentState();
		assert.deepEqual(state.availableActions, ["click-login"]);
	});

	it("detects server-login view from URL", async () => {
		const driver = createTestDriver("true", "http://127.0.0.1:3000/login?return=%2Foauth");
		const handler = new LoginFlowStateHandler(
			driver,
			async () => false,
			new Map(),
		);

		const state = await handler.detectCurrentState();
		assert.equal(state.activeView, "server-login");
	});

	it("detects oauth-authorize view from URL", async () => {
		const driver = createTestDriver("true", "http://127.0.0.1:3000/oauth/authorize?client_id=test");
		const handler = new LoginFlowStateHandler(
			driver,
			async () => false,
			new Map(),
		);

		const state = await handler.detectCurrentState();
		assert.equal(state.activeView, "oauth-authorize");
	});

	it("executes a known action", async () => {
		const driver = createTestDriver(null);
		let executed = false;
		const action: FlowAction = {
			isAvailable: async () => true,
			execute: async () => {
				executed = true;
			},
		};

		const handler = new LoginFlowStateHandler(
			driver,
			async () => false,
			new Map([["click-login", action]]),
		);

		await handler.executeAction("click-login");
		assert.equal(executed, true);
	});
});
