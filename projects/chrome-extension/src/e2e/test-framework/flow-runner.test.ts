import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { FlowRunner } from "./flow-runner";
import type { FlowStateHandler } from "./flow-state-handler.types";

function createTestPage(): Page {
	return {
		goto: async () => {},
	} as unknown as Page;
}

describe("FlowRunner", () => {
	it("returns error when no actions are available", async () => {
		const page = createTestPage();
		const stateHandler: FlowStateHandler = {
			detectCurrentState: async () => ({
				activeView: "loading-view",
				availableActions: [],
			}),
			executeAction: async () => {},
		};

		const runner = new FlowRunner(page, stateHandler);
		const result = await runner.run("chrome-extension://test/popup.html", {
			maxSteps: 10,
		});

		assert.equal(result.success, false);
		assert.ok(result.error?.includes("No available actions at step 0"));
	});

	it("returns error when max steps exceeded", async () => {
		const page = createTestPage();
		let detectCount = 0;
		const stateHandler: FlowStateHandler = {
			detectCurrentState: async () => ({
				activeView: `view-${detectCount++}`,
				availableActions: ["some-action"],
			}),
			executeAction: async () => {},
		};

		const runner = new FlowRunner(page, stateHandler);
		const result = await runner.run("chrome-extension://test/popup.html", {
			maxSteps: 2,
		});

		assert.equal(result.success, false);
		assert.ok(result.error?.includes("Max steps (2) exceeded"));
	});
});
