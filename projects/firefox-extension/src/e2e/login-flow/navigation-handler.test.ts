import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { WebDriver } from "selenium-webdriver";
import { LoginFlowStateHandler } from "./navigation-handler";
import type { FlowAction } from "../test-framework/flow-state-handler.types";

function createTestDriver(getAttributeValue: string | null): WebDriver {
	return {
		findElement: async () => ({
			getAttribute: async () => getAttributeValue,
		}),
	} as unknown as WebDriver;
}

describe("LoginFlowStateHandler", () => {
	it("throws when no visible view is found", async () => {
		const driver = createTestDriver("true");
		const handler = new LoginFlowStateHandler(
			driver,
			async () => false,
			new Map(),
		);

		await assert.rejects(() => handler.detectCurrentState(), {
			message: "No visible view found",
		});
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
});
