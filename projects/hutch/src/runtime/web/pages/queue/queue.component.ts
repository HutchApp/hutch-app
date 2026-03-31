import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { render } from "../../render";
import { QUEUE_STYLES } from "./queue.styles";
import type { ArticleAction, QueueArticleViewModel, QueueViewModel } from "./queue.viewmodel";
import { buildQueueUrl } from "./queue.url";

const QUEUE_TEMPLATE = readFileSync(join(__dirname, "queue.template.html"), "utf-8");

interface ActionDisplayModel extends ArticleAction {
	buttonClass: string;
	boost: boolean;
}

interface ArticleDisplayModel extends QueueArticleViewModel {
	linkUrl: string;
	isExternalLink: boolean;
	unreadClass: string;
	actions: ActionDisplayModel[];
}

function toActionDisplayModel(action: ArticleAction): ActionDisplayModel {
	return {
		...action,
		buttonClass: action.testAction === "delete"
			? "queue-article__action-btn queue-article__action-btn--delete"
			: "queue-article__action-btn",
		boost: !action.pageReload,
	};
}

function toArticleDisplayModel(article: QueueArticleViewModel): ArticleDisplayModel {
	return {
		...article,
		linkUrl: article.hasContent ? `/queue/${article.id}/read` : article.url,
		isExternalLink: !article.hasContent,
		unreadClass: article.isUnread ? " queue-article--unread" : "",
		actions: article.actions.map(toActionDisplayModel),
	};
}

interface QueueDisplayModel {
	total: number;
	pluralSuffix: string;
	saveError?: string;
	isEmpty: boolean;
	hasArticles: boolean;
	articles: ArticleDisplayModel[];
	filterUnreadClass: string;
	filterUnreadLabel: string;
	filterReadClass: string;
	filterUnreadUrl: string;
	filterReadUrl: string;
	sortUrl: string;
	sortLabel: string;
	showPagination: boolean;
	hasPrev: boolean;
	hasNext: boolean;
	prevUrl?: string;
	nextUrl?: string;
	currentPage: number;
	totalPages: number;
}

function filterLinkClass(isActive: boolean): string {
	return `queue__filter-link${isActive ? " queue__filter-link--active" : ""}`;
}

export function formatUnreadLabel(count: number): string {
	return count > 99 ? "Unread (99+)" : `Unread (${count})`;
}

function toQueueDisplayModel(vm: QueueViewModel): QueueDisplayModel {
	const activeStatus = vm.filters.status;
	const nextOrder = vm.filters.order === "desc" ? "asc" : "desc";
	const sortLabel = vm.filters.order === "desc" ? "Newest first ↓" : "Oldest first ↑";
	const sortUrl = buildQueueUrl({ status: activeStatus, order: nextOrder });

	return {
		total: vm.total,
		pluralSuffix: vm.total !== 1 ? "s" : "",
		saveError: vm.saveError,
		isEmpty: vm.isEmpty,
		hasArticles: !vm.isEmpty,
		articles: vm.articles.map(toArticleDisplayModel),
		filterUnreadClass: filterLinkClass(activeStatus === "unread"),
		filterUnreadLabel: formatUnreadLabel(vm.unreadCount),
		filterReadClass: filterLinkClass(activeStatus === "read"),
		filterUnreadUrl: vm.filterUrls.unread,
		filterReadUrl: vm.filterUrls.read,
		sortUrl,
		sortLabel,
		showPagination: vm.totalPages > 1,
		hasPrev: Boolean(vm.paginationUrls.prev),
		hasNext: Boolean(vm.paginationUrls.next),
		prevUrl: vm.paginationUrls.prev,
		nextUrl: vm.paginationUrls.next,
		currentPage: vm.currentPage,
		totalPages: vm.totalPages,
	};
}

const HTMX_SCRIPTS = `<script src="https://cdn.jsdelivr.net/npm/htmx.org@2.0.8/dist/htmx.min.js" integrity="sha384-/TgkGk7p307TH7EXJDuUlgG3Ce1UVolAOFopFekQkkXihi5u/6OCvVKyz1W+idaz" crossorigin="anonymous"></script>`;

export function QueuePage(vm: QueueViewModel, options?: { emailVerified?: boolean }): Component {
	const displayModel = toQueueDisplayModel(vm);
	const content = render(QUEUE_TEMPLATE, displayModel);

	return Base({
		seo: {
			title: "My Queue — Hutch",
			description: "Your saved articles reading queue.",
			canonicalUrl: "/queue",
			robots: "noindex, nofollow",
		},
		styles: QUEUE_STYLES,
		bodyClass: "page-queue",
		content,
		scripts: HTMX_SCRIPTS,
		isAuthenticated: true,
		emailVerified: options?.emailVerified,
	});
}
