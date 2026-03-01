import type { ArticleStatus } from "../../../domain/article/article.types";
import type { SortOrder } from "../../../providers/article-store/article-store.types";

export interface QueueUrlState {
	status?: ArticleStatus;
	starred?: boolean;
	order: SortOrder;
	page: number;
}

const VALID_STATUSES: ArticleStatus[] = ["unread", "read", "archived"];
const VALID_ORDERS: SortOrder[] = ["asc", "desc"];

export function parseQueueUrl(query: Record<string, unknown>): QueueUrlState {
	const status = VALID_STATUSES.includes(query.status as ArticleStatus)
		? (query.status as ArticleStatus)
		: undefined;

	const starred =
		query.starred === "true" ? true : query.starred === "false" ? false : undefined;

	const order = VALID_ORDERS.includes(query.order as SortOrder)
		? (query.order as SortOrder)
		: "desc";

	const rawPage = Number(query.page);
	const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;

	return { status, starred, order, page };
}

export function buildQueueUrl(state: Partial<QueueUrlState>): string {
	const params = new URLSearchParams();

	if (state.status) {
		params.set("status", state.status);
	}
	if (state.starred !== undefined) {
		params.set("starred", String(state.starred));
	}
	if (state.order && state.order !== "desc") {
		params.set("order", state.order);
	}
	if (state.page && state.page > 1) {
		params.set("page", String(state.page));
	}

	const qs = params.toString();
	return qs ? `/queue?${qs}` : "/queue";
}
