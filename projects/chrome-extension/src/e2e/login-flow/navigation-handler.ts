import type { Page } from "playwright";
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
];

const TRANSITIONING_VIEW = "transitioning";

type SuccessDetector = (page: Page) => Promise<boolean>;

export class LoginFlowStateHandler implements FlowStateHandler {
	constructor(
		private page: Page,
		private successDetector: SuccessDetector,
		private actions: Map<string, FlowAction>,
	) {}

	async detectCurrentState(): Promise<FlowState> {
		const activeView = await this.getActiveView();

		const isSuccess = await this.successDetector(this.page);
		if (isSuccess) {
			return { activeView, availableActions: ["complete"] };
		}

		const availableActions: string[] = [];
		for (const [actionName, action] of this.actions) {
			if (await action.isAvailable(this.page)) {
				availableActions.push(actionName);
			}
		}

		return { activeView, availableActions };
	}

	async executeAction(actionName: string): Promise<void> {
		const action = this.actions.get(actionName);
		if (!action) throw new Error(`Action '${actionName}' not found`);
		await action.execute(this.page);
	}

	private async getActiveView(): Promise<string> {
		try {
			const serverPages = [
				{ className: "page-login", view: "server-login" },
				{ className: "page-oauth-authorize", view: "oauth-authorize" },
			];

			for (const { className, view } of serverPages) {
				const bodyWithClass = await this.page.$(`body.${className}`);
				if (bodyWithClass) return view;
			}

			for (const viewId of VIEW_IDS) {
				const element = await this.page.$(`#${viewId}`);
				if (!element) continue;
				const hidden = await element.getAttribute("hidden");
				if (hidden === null) {
					return viewId;
				}
			}
			return TRANSITIONING_VIEW;
		} catch {
			return "tab-closed";
		}
	}
}
