import type { SavedArticle } from "../../../domain/article/article.types";
import type { FindArticlesResult } from "../../../providers/article-store/article-store.types";
import type { QueueUrlState } from "./queue.url";
import { buildQueueUrl } from "./queue.url";

export interface QueueArticleViewModel {
	id: string;
	title: string;
	siteName: string;
	excerpt: string;
	url: string;
	readTimeLabel: string;
	status: string;
	isStarred: boolean;
	savedAgo: string;
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
		starred: string;
	};
	paginationUrls: {
		prev?: string;
		next?: string;
	};
	showUrlToggle: {
		label: string;
		url: string;
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

function toArticleViewModel(
	article: SavedArticle,
	now: Date,
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
		isStarred: article.isStarred,
		savedAgo: formatRelativeDate(article.savedAt, now),
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

	return {
		articles: result.articles.map((a) => toArticleViewModel(a, now)),
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
			starred: buildQueueUrl({ ...baseFilters, starred: true }),
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
		showUrlToggle: filters.showUrl
			? { label: "Hide URLs", url: buildQueueUrl({ ...filters, showUrl: undefined }) }
			: { label: "Show URLs", url: buildQueueUrl({ ...filters, showUrl: true }) },
		saveError: options?.saveError,
	};
}
