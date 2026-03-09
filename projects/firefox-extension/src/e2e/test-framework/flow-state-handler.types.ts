import type { WebDriver } from "selenium-webdriver";

export type FlowAction = {
	execute: (driver: WebDriver) => Promise<void>;
	isAvailable: (driver: WebDriver) => Promise<boolean>;
};

export type FlowState = {
	activeView: string;
	availableActions: string[];
};

export type FlowStateHandler = {
	detectCurrentState(): Promise<FlowState>;
	executeAction(actionName: string): Promise<void>;
};
