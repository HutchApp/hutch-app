import type { Page } from "playwright";

export type FlowAction = {
	execute: (page: Page) => Promise<void>;
	isAvailable: (page: Page) => Promise<boolean>;
};

export type FlowState = {
	activeView: string;
	availableActions: string[];
};

export type FlowStateHandler = {
	detectCurrentState(): Promise<FlowState>;
	executeAction(actionName: string): Promise<void>;
};
