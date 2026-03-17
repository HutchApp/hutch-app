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
type GetActivePage = () => Page;

export class LoginFlowStateHandler implements FlowStateHandler {
	constructor(
		private getActivePage: GetActivePage,
		private successDetector: SuccessDetector,
		private actions: Map<string, FlowAction>,
	) {}

	async detectCurrentState(): Promise<FlowState> {
		const page = this.getActivePage();
		const activeView = await this.getActiveView(page);

		if (activeView === "tab-closed") {
			return { activeView, availableActions: ["switch-to-popup"] };
		}

		const isSuccess = await this.successDetector(page);
		if (isSuccess) {
			return { activeView, availableActions: ["complete"] };
		}

		const availableActions: string[] = [];
		for (const [actionName, action] of this.actions) {
			if (await action.isAvailable(page)) {
				availableActions.push(actionName);
			}
		}

		return { activeView, availableActions };
	}

	async executeAction(actionName: string): Promise<void> {
		const action = this.actions.get(actionName);
		if (!action) throw new Error(`Action '${actionName}' not found`);
		await action.execute(this.getActivePage());
	}

	private async getActiveView(page: Page): Promise<string> {
		if (page.isClosed()) return "tab-closed";
		try {
			const serverPages = [
				{ className: "page-login", view: "server-login" },
				{ className: "page-oauth-authorize", view: "oauth-authorize" },
			];

			for (const { className, view } of serverPages) {
				const bodyWithClass = await page.$(`body.${className}`);
				if (bodyWithClass) return view;
			}

			for (const viewId of VIEW_IDS) {
				const element = await page.$(`#${viewId}`);
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
