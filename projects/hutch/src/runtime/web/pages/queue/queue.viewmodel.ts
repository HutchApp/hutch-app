import type { SavedArticle } from "../../../domain/article/article.types";
import type { FindArticlesResult } from "../../../providers/article-store/article-store.types";
import type { QueueUrlState } from "./queue.url";
import { buildQueueUrl } from "./queue.url";

export interface ArticleActionField {
	name: string;
	value: string;
}

export interface ArticleAction {
	method: string;
	url: string;
	text: string;
	title: string;
	testAction: string;
	fields: ArticleActionField[];
}

export interface QueueArticleViewModel {
	id: string;
	title: string;
	siteName: string;
	excerpt: string;
	url: string;
	readTimeLabel: string;
	status: string;
	isUnread: boolean;
	savedAgo: string;
	imageUrl?: string;
	hasContent: boolean;
	actions: ArticleAction[];
}

export interface QueueViewModel {
	articles: QueueArticleViewModel[];
	filters: QueueUrlState;
	isEmpty: boolean;
	totalPages: number;
	currentPage: number;
	total: number;
	filterUrls: {
		all: string;
		unread: string;
		read: string;
		archived: string;
	};
	paginationUrls: {
		prev?: string;
		next?: string;
	};
	saveError?: string;
}

function formatRelativeDate(date: Date, now: Date): string {
	const diffMs = now.getTime() - date.getTime();
	const diffMinutes = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMinutes < 1) return "just now";
	if (diffMinutes < 60) return `${diffMinutes}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 30) return `${diffDays}d ago`;
	return date.toLocaleDateString("en-AU", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

function toArticleActions(
	article: { id: string; status: string },
	returnQuery: string,
): ArticleAction[] {
	const actions: ArticleAction[] = [];

	if (article.status !== "read") {
		actions.push({
			method: "POST",
			url: `/queue/${article.id}/status${returnQuery}`,
			text: "Read",
			title: "Mark as read",
			testAction: "mark-read",
			fields: [{ name: "status", value: "read" }],
		});
	}

	if (article.status !== "unread") {
		actions.push({
			method: "POST",
			url: `/queue/${article.id}/status${returnQuery}`,
			text: "Unread",
			title: "Mark as unread",
			testAction: "mark-unread",
			fields: [{ name: "status", value: "unread" }],
		});
	}

	if (article.status !== "archived") {
		actions.push({
			method: "POST",
			url: `/queue/${article.id}/status${returnQuery}`,
			text: "Archive",
			title: "Archive",
			testAction: "archive",
			fields: [{ name: "status", value: "archived" }],
		});
	}

	actions.push({
		method: "POST",
		url: `/queue/${article.id}/delete${returnQuery}`,
		text: "×",
		title: "Delete",
		testAction: "delete",
		fields: [],
	});

	return actions;
}

function toArticleViewModel(
	article: SavedArticle,
	now: Date,
	returnQuery: string,
): QueueArticleViewModel {
	const readTime = article.estimatedReadTime;
	return {
		id: article.id,
		title: article.metadata.title,
		siteName: article.metadata.siteName,
		excerpt: article.metadata.excerpt,
		url: article.url,
		readTimeLabel: `${readTime} min read`,
		status: article.status,
		isUnread: article.status === "unread",
		savedAgo: formatRelativeDate(article.savedAt, now),
		imageUrl: article.metadata.imageUrl,
		hasContent: Boolean(article.content),
		actions: toArticleActions(article, returnQuery),
	};
}

export function toQueueViewModel(
	result: FindArticlesResult,
	filters: QueueUrlState,
	options?: { now?: Date; saveError?: string },
): QueueViewModel {
	const now = options?.now ?? new Date();
	const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
	const baseFilters = { order: filters.order };
	const queueUrl = buildQueueUrl(filters);
	const queryIndex = queueUrl.indexOf("?");
	const returnQuery = queryIndex !== -1 ? queueUrl.slice(queryIndex) : "";

	return {
		articles: result.articles.map((a) => toArticleViewModel(a, now, returnQuery)),
		filters,
		isEmpty: result.total === 0,
		totalPages,
		currentPage: result.page,
		total: result.total,
		filterUrls: {
			all: buildQueueUrl(baseFilters),
			unread: buildQueueUrl({ ...baseFilters, status: "unread" }),
			read: buildQueueUrl({ ...baseFilters, status: "read" }),
			archived: buildQueueUrl({ ...baseFilters, status: "archived" }),
		},
		paginationUrls: {
			prev:
				result.page > 1
					? buildQueueUrl({ ...filters, page: result.page - 1 })
					: undefined,
			next:
				result.page < totalPages
					? buildQueueUrl({ ...filters, page: result.page + 1 })
					: undefined,
		},
		saveError: options?.saveError,
	};
}
