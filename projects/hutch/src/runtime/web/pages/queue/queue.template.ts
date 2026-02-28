import type { PageContent } from "../../base.component";
import { QUEUE_STYLES } from "./queue.styles";
import type { QueueArticleViewModel, QueueViewModel } from "./queue.viewmodel";

function renderArticle(
	article: QueueArticleViewModel,
	options: { showUrl: boolean },
): string {
	const starClass = article.isStarred
		? " queue-article__action-btn--starred"
		: "";
	const starLabel = article.isStarred ? "Unstar" : "Star";

	const statusActions: string[] = [];
	if (article.status !== "read") {
		statusActions.push(`
      <form method="POST" action="/queue/${article.id}/status" style="display:inline">
        <input type="hidden" name="status" value="read">
        <button class="queue-article__action-btn" type="submit" title="Mark as read">Read</button>
      </form>`);
	}
	if (article.status !== "unread") {
		statusActions.push(`
      <form method="POST" action="/queue/${article.id}/status" style="display:inline">
        <input type="hidden" name="status" value="unread">
        <button class="queue-article__action-btn" type="submit" title="Mark as unread">Unread</button>
      </form>`);
	}
	if (article.status !== "archived") {
		statusActions.push(`
      <form method="POST" action="/queue/${article.id}/status" style="display:inline">
        <input type="hidden" name="status" value="archived">
        <button class="queue-article__action-btn" type="submit" title="Archive">Archive</button>
      </form>`);
	}

	return `
    <div class="queue-article" data-test-article="${article.id}">
      <div class="queue-article__content">
        <a class="queue-article__title" href="${article.url}" target="_blank" rel="noopener">${article.title}</a>
        ${options.showUrl ? `<span class="queue-article__url" data-test-article-url>${article.url}</span>` : ""}
        <div class="queue-article__meta">
          <span>${article.siteName}</span>
          <span>${article.readTimeLabel}</span>
          <span>${article.savedAgo}</span>
        </div>
        <p class="queue-article__excerpt">${article.excerpt}</p>
      </div>
      <div class="queue-article__actions">
        <form method="POST" action="/queue/${article.id}/star" style="display:inline">
          <button class="queue-article__action-btn${starClass}" type="submit" title="${starLabel}" data-test-action="star">${article.isStarred ? "★" : "☆"}</button>
        </form>
        ${statusActions.join("")}
        <form method="POST" action="/queue/${article.id}/delete" style="display:inline">
          <button class="queue-article__action-btn queue-article__action-btn--delete" type="submit" title="Delete" data-test-action="delete">×</button>
        </form>
      </div>
    </div>`;
}

function renderFilters(vm: QueueViewModel): string {
	const activeStatus = vm.filters.status;
	const isStarred = vm.filters.starred;

	function cls(isActive: boolean): string {
		return `queue__filter-link${isActive ? " queue__filter-link--active" : ""}`;
	}

	return `
    <nav class="queue__filters" data-test-filters>
      <a class="${cls(!activeStatus && !isStarred)}" href="${vm.filterUrls.all}">All</a>
      <a class="${cls(activeStatus === "unread")}" href="${vm.filterUrls.unread}">Unread</a>
      <a class="${cls(activeStatus === "read")}" href="${vm.filterUrls.read}">Read</a>
      <a class="${cls(activeStatus === "archived")}" href="${vm.filterUrls.archived}">Archived</a>
      <a class="${cls(isStarred === true)}" href="${vm.filterUrls.starred}">Starred</a>
    </nav>`;
}

function renderSortToggle(vm: QueueViewModel): string {
	const nextOrder = vm.filters.order === "desc" ? "asc" : "desc";
	const label =
		vm.filters.order === "desc" ? "Newest first ↓" : "Oldest first ↑";
	const url = `/queue?order=${nextOrder}${vm.filters.status ? `&status=${vm.filters.status}` : ""}`;

	return `
    <div class="queue__sort">
      <a class="queue__sort-link" href="${vm.showUrlToggle.url}" data-test-show-url>${vm.showUrlToggle.label}</a>
      <a class="queue__sort-link" href="${url}" data-test-sort>${label}</a>
    </div>`;
}

function renderPagination(vm: QueueViewModel): string {
	if (vm.totalPages <= 1) return "";

	return `
    <nav class="queue__pagination" data-test-pagination>
      ${vm.paginationUrls.prev ? `<a class="queue__pagination-link" href="${vm.paginationUrls.prev}">← Previous</a>` : ""}
      <span class="queue__pagination-info">Page ${vm.currentPage} of ${vm.totalPages}</span>
      ${vm.paginationUrls.next ? `<a class="queue__pagination-link" href="${vm.paginationUrls.next}">Next →</a>` : ""}
    </nav>`;
}

function renderEmpty(): string {
	return `
    <div class="queue__empty" data-test-empty-queue>
      <h2 class="queue__empty-title">Your queue is empty</h2>
      <p class="queue__empty-text">Paste a URL above to save your first article.</p>
    </div>`;
}

export function createQueuePageContent(vm: QueueViewModel): PageContent {
	const content = `
    <main class="queue">
      <div class="queue__header">
        <h1 class="queue__title">My Queue</h1>
        <span class="queue__count" data-test-article-count>${vm.total} article${vm.total !== 1 ? "s" : ""}</span>
      </div>
      <form class="queue__save-form" method="POST" action="/queue/save" data-test-form="save-article">
        <input class="queue__save-input" type="url" name="url" placeholder="Paste a URL to save an article…" required>
        <button class="queue__save-btn" type="submit">Save</button>
      </form>
      ${vm.saveError ? `<p class="queue__save-error" data-test-save-error>${vm.saveError}</p>` : ""}
      ${renderFilters(vm)}
      ${renderSortToggle(vm)}
      ${vm.isEmpty ? renderEmpty() : `<div class="queue__list" data-test-article-list>${vm.articles.map((a) => renderArticle(a, { showUrl: vm.filters.showUrl === true })).join("")}</div>`}
      ${renderPagination(vm)}
    </main>`;

	return {
		seo: {
			title: "My Queue — Hutch",
			description: "Your saved articles reading queue.",
			canonicalUrl: "/queue",
			robots: "noindex, nofollow",
		},
		styles: QUEUE_STYLES,
		bodyClass: "page-queue",
		content,
		isAuthenticated: true,
	};
}
