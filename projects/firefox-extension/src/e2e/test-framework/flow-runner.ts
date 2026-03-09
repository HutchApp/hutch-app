import type { WebDriver } from "selenium-webdriver";
import type { FlowState, FlowStateHandler } from "./flow-state-handler.types";

export class FlowRunner {
	constructor(
		private driver: WebDriver,
		private stateHandler: FlowStateHandler,
	) {}

	async run(
		startUrl: string,
		config: { maxSteps: number; actionDelayMs?: number },
	): Promise<{ success: boolean; currentState: FlowState; error?: string }> {
		await this.driver.get(startUrl);

		for (let step = 0; step < config.maxSteps; step++) {
			const state = await this.stateHandler.detectCurrentState();

			if (state.availableActions.includes("complete")) {
				return { success: true, currentState: state };
			}

			if (state.availableActions.length === 0) {
				return {
					success: false,
					currentState: state,
					error: `No available actions at step ${step}. Active view: ${state.activeView}`,
				};
			}

			const actionName = state.availableActions[0];
			if (config.actionDelayMs) {
				await new Promise((resolve) => setTimeout(resolve, config.actionDelayMs));
			}
			await this.stateHandler.executeAction(actionName);

			const previousView = state.activeView;
			await this.driver.wait(async () => {
				const newState =
					await this.stateHandler.detectCurrentState();
				return newState.activeView !== previousView;
			}, 10000);
		}

		const finalState = await this.stateHandler.detectCurrentState();
		return {
			success: false,
			currentState: finalState,
			error: `Max steps (${config.maxSteps}) exceeded`,
		};
	}
}
