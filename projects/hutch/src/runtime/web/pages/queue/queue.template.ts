import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { QUEUE_STYLES } from "./queue.styles";
import type { QueueArticleViewModel, QueueViewModel } from "./queue.viewmodel";

function renderArticle(
	article: QueueArticleViewModel,
	options: { showUrl: boolean },
): string {
	const unreadClass = article.isUnread ? " queue-article--unread" : "";
	const unreadDot = article.isUnread
		? '<span class="queue-article__unread-dot" aria-label="Unread"></span>'
		: "";

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

	const thumbnail = article.imageUrl
		? `<img class="queue-article__thumbnail" src="${article.imageUrl}" alt="" loading="lazy">`
		: "";

	return `
    <div class="queue-article${unreadClass}" data-test-article="${article.id}" data-article-id="${article.id}">
      ${thumbnail}
      <div class="queue-article__content">
        <div class="queue-article__title-row">
          ${unreadDot}
          <a class="queue-article__title" href="${article.hasContent ? `/queue/${article.id}/read` : article.url}"${article.hasContent ? "" : ' target="_blank" rel="noopener"'} data-test-article-title>${article.title}</a>
        </div>
        ${options.showUrl ? `<span class="queue-article__url" data-test-article-url>${article.url}</span>` : ""}
        <div class="queue-article__meta">
          <span>${article.siteName}</span>
          <span>${article.readTimeLabel}</span>
          <span>${article.savedAgo}</span>
        </div>
        <p class="queue-article__excerpt">${article.excerpt}</p>
      </div>
      <div class="queue-article__actions">
        ${statusActions.join("")}
        <form method="POST" action="/queue/${article.id}/delete" style="display:inline">
          <button class="queue-article__action-btn queue-article__action-btn--delete" type="submit" title="Delete" data-test-action="delete">×</button>
        </form>
      </div>
    </div>`;
}

function renderFilters(vm: QueueViewModel): string {
	const activeStatus = vm.filters.status;

	function cls(isActive: boolean): string {
		return `queue__filter-link${isActive ? " queue__filter-link--active" : ""}`;
	}

	return `
    <nav class="queue__filters" data-test-filters>
      <a class="${cls(!activeStatus)}" href="${vm.filterUrls.all}">All</a>
      <a class="${cls(activeStatus === "unread")}" href="${vm.filterUrls.unread}">Unread</a>
      <a class="${cls(activeStatus === "read")}" href="${vm.filterUrls.read}">Read</a>
      <a class="${cls(activeStatus === "archived")}" href="${vm.filterUrls.archived}">Archived</a>
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

const MARK_READ_ON_CLICK_SCRIPT = `
<script>
(function() {
  var articles = document.querySelectorAll('.queue-article--unread');
  for (var i = 0; i < articles.length; i++) {
    (function(article) {
      var link = article.querySelector('.queue-article__title');
      if (!link) return;

      link.addEventListener('click', function() {
        var id = article.getAttribute('data-article-id');
        if (!id) return;

        fetch('/queue/' + id + '/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'status=read'
        }).then(function() {
          article.classList.remove('queue-article--unread');
          var dot = article.querySelector('.queue-article__unread-dot');
          if (dot) dot.remove();
        }).catch(function() {
          // Silently fail - user can use the Read button as fallback
        });
      });
    })(articles[i]);
  }
})();
</script>`;

export function QueuePage(vm: QueueViewModel): Component {
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
		scripts: MARK_READ_ON_CLICK_SCRIPT,
		isAuthenticated: true,
	});
}
