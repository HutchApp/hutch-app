import type { WebDriver } from "selenium-webdriver";
import { By } from "selenium-webdriver";
import type {
	FlowAction,
	FlowState,
	FlowStateHandler,
} from "../test-framework/flow-state-handler.types";

const VIEW_IDS = [
	"login-view",
	"saved-view",
	"already-saved-view",
	"removed-view",
	"list-view",
	"loading-view",
	"error-view",
];

type SuccessDetector = (driver: WebDriver) => Promise<boolean>;

export class LoginFlowStateHandler implements FlowStateHandler {
	constructor(
		private driver: WebDriver,
		private successDetector: SuccessDetector,
		private actions: Map<string, FlowAction>,
	) {}

	async detectCurrentState(): Promise<FlowState> {
		const activeView = await this.getActiveView();

		const isSuccess = await this.successDetector(this.driver);
		if (isSuccess) {
			return { activeView, availableActions: ["complete"] };
		}

		const availableActions: string[] = [];
		for (const [actionName, action] of this.actions) {
			if (await action.isAvailable(this.driver)) {
				availableActions.push(actionName);
			}
		}

		return { activeView, availableActions };
	}

	async executeAction(actionName: string): Promise<void> {
		const action = this.actions.get(actionName);
		if (!action) throw new Error(`Action '${actionName}' not found`);
		await action.execute(this.driver);
	}

	private async getActiveView(): Promise<string> {
		const url = await this.driver.getCurrentUrl();
		if (url.includes("/login")) return "server-login";
		if (url.includes("/oauth/authorize")) return "oauth-authorize";
		if (url.includes("/oauth/callback")) return "oauth-callback";

		for (const viewId of VIEW_IDS) {
			const element = await this.driver.findElement(By.id(viewId));
			const hidden = await element.getAttribute("hidden");
			if (hidden === null) {
				return viewId;
			}
		}
		throw new Error("No visible view found");
	}
}
