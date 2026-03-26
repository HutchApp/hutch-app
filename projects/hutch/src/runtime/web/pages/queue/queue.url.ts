import { z } from "zod";
import type { ArticleStatus } from "../../../domain/article/article.types";
import type { SortOrder } from "../../../providers/article-store/article-store.types";

export interface QueueUrlState {
	status: ArticleStatus;
	order: SortOrder;
	page: number;
}

const QueueQuerySchema = z.object({
	status: z.enum(["unread", "read"]).optional().catch(undefined),
	order: z.enum(["asc", "desc"]).optional().catch(undefined),
	page: z.coerce.number().int().min(1).optional().catch(undefined),
}).passthrough();

export function parseQueueUrl(query: Record<string, unknown>): QueueUrlState {
	const parsed = QueueQuerySchema.parse(query);
	return {
		status: parsed.status ?? "unread",
		order: parsed.order ?? "desc",
		page: parsed.page ?? 1,
	};
}

export function buildQueueUrl(state: Partial<QueueUrlState>): string {
	const params = new URLSearchParams();

	if (state.status && state.status !== "unread") {
		params.set("status", state.status);
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
