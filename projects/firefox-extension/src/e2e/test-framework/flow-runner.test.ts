import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { WebDriver } from "selenium-webdriver";
import { FlowRunner } from "./flow-runner";
import type { FlowStateHandler } from "./flow-state-handler.types";

function createTestDriver(): WebDriver {
	return {
		get: async () => {},
		wait: async (condition: () => Promise<boolean>) => {
			for (let i = 0; i < 50; i++) {
				if (await condition()) return;
			}
		},
	} as unknown as WebDriver;
}

describe("FlowRunner", () => {
	it("returns error when no actions are available", async () => {
		const driver = createTestDriver();
		const stateHandler: FlowStateHandler = {
			detectCurrentState: async () => ({
				activeView: "loading-view",
				availableActions: [],
			}),
			executeAction: async () => {},
		};

		const runner = new FlowRunner(driver, stateHandler);
		const result = await runner.run("moz-extension://test/popup.html", {
			maxSteps: 10,
			actionDelayMs: 0,
		});

		assert.equal(result.success, false);
		assert.ok(result.error?.includes("No available actions at step 0"));
	});

	it("returns error when max steps exceeded", async () => {
		const driver = createTestDriver();
		let detectCount = 0;
		const stateHandler: FlowStateHandler = {
			detectCurrentState: async () => ({
				activeView: `view-${detectCount++}`,
				availableActions: ["some-action"],
			}),
			executeAction: async () => {},
		};

		const runner = new FlowRunner(driver, stateHandler);
		const result = await runner.run("moz-extension://test/popup.html", {
			maxSteps: 2,
			actionDelayMs: 1,
		});

		assert.equal(result.success, false);
		assert.ok(result.error?.includes("Max steps (2) exceeded"));
	});
});
