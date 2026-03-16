import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { LoginFlowStateHandler } from "./navigation-handler";
import type { FlowAction } from "../test-framework/flow-state-handler.types";

function createTestPage(getAttributeValue: string | null, bodyClass?: string): Page {
	return {
		$: async (selector: string) => {
			if (bodyClass && selector.includes(bodyClass)) {
				return { getAttribute: async () => getAttributeValue };
			}
			if (selector.startsWith("body.")) {
				return null;
			}
			return { getAttribute: async () => getAttributeValue };
		},
		url: () => "chrome-extension://test/popup.html",
	} as unknown as Page;
}

describe("LoginFlowStateHandler", () => {
	it("returns transitioning view when no visible view is found", async () => {
		const page = createTestPage("true");
		const handler = new LoginFlowStateHandler(
			page,
			async () => false,
			new Map(),
		);

		const state = await handler.detectCurrentState();
		assert.equal(state.activeView, "transitioning");
	});

	it("throws when executing an unknown action", async () => {
		const page = createTestPage(null);
		const handler = new LoginFlowStateHandler(
			page,
			async () => false,
			new Map(),
		);

		await assert.rejects(() => handler.executeAction("nonexistent"), {
			message: "Action 'nonexistent' not found",
		});
	});

	it("excludes unavailable actions from state", async () => {
		const page = createTestPage(null);
		const unavailableAction: FlowAction = {
			isAvailable: async () => false,
			execute: async () => {},
		};

		const handler = new LoginFlowStateHandler(
			page,
			async () => false,
			new Map([["unavailable-action", unavailableAction]]),
		);

		const state = await handler.detectCurrentState();
		assert.deepEqual(state.availableActions, []);
	});

	it("includes available actions in state", async () => {
		const page = createTestPage(null);
		const availableAction: FlowAction = {
			isAvailable: async () => true,
			execute: async () => {},
		};

		const handler = new LoginFlowStateHandler(
			page,
			async () => false,
			new Map([["click-login", availableAction]]),
		);

		const state = await handler.detectCurrentState();
		assert.deepEqual(state.availableActions, ["click-login"]);
	});

	it("detects server-login view from body class", async () => {
		const page = createTestPage("true", "page-login");
		const handler = new LoginFlowStateHandler(
			page,
			async () => false,
			new Map(),
		);

		const state = await handler.detectCurrentState();
		assert.equal(state.activeView, "server-login");
	});

	it("detects oauth-authorize view from body class", async () => {
		const page = createTestPage("true", "page-oauth-authorize");
		const handler = new LoginFlowStateHandler(
			page,
			async () => false,
			new Map(),
		);

		const state = await handler.detectCurrentState();
		assert.equal(state.activeView, "oauth-authorize");
	});

	it("executes a known action", async () => {
		const page = createTestPage(null);
		let executed = false;
		const action: FlowAction = {
			isAvailable: async () => true,
			execute: async () => {
				executed = true;
			},
		};

		const handler = new LoginFlowStateHandler(
			page,
			async () => false,
			new Map([["click-login", action]]),
		);

		await handler.executeAction("click-login");
		assert.equal(executed, true);
	});
});
