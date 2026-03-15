import type { ArticleStatus } from "../../../domain/article/article.types";
import type { SortOrder } from "../../../providers/article-store/article-store.types";

export interface QueueUrlState {
	status?: ArticleStatus;
	order: SortOrder;
	page: number;
	showUrl?: boolean;
}

const VALID_STATUSES: ArticleStatus[] = ["unread", "read", "archived"];
const VALID_ORDERS: SortOrder[] = ["asc", "desc"];

export function parseQueueUrl(query: Record<string, unknown>): QueueUrlState {
	const status = VALID_STATUSES.includes(query.status as ArticleStatus)
		? (query.status as ArticleStatus)
		: undefined;

	const order = VALID_ORDERS.includes(query.order as SortOrder)
		? (query.order as SortOrder)
		: "desc";

	const rawPage = Number(query.page);
	const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;

	const showUrl = query.showUrl === "true" ? true : undefined;

	return { status, order, page, showUrl };
}

export function buildQueueUrl(state: Partial<QueueUrlState>): string {
	const params = new URLSearchParams();

	if (state.status) {
		params.set("status", state.status);
	}
	if (state.order && state.order !== "desc") {
		params.set("order", state.order);
	}
	if (state.page && state.page > 1) {
		params.set("page", String(state.page));
	}
	if (state.showUrl) {
		params.set("showUrl", "true");
	}

	const qs = params.toString();
	return qs ? `/queue?${qs}` : "/queue";
}
