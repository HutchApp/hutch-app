import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { render } from "../../render";
import { QUEUE_STYLES } from "./queue.styles";
import type { QueueArticleViewModel, QueueViewModel } from "./queue.viewmodel";

interface ArticleDisplayModel extends QueueArticleViewModel {
	showMarkRead: boolean;
	showMarkUnread: boolean;
	showArchive: boolean;
	linkUrl: string;
	isExternalLink: boolean;
	unreadClass: string;
}

function toArticleDisplayModel(article: QueueArticleViewModel): ArticleDisplayModel {
	return {
		...article,
		showMarkRead: article.status !== "read",
		showMarkUnread: article.status !== "unread",
		showArchive: article.status !== "archived",
		linkUrl: article.hasContent ? `/queue/${article.id}/read` : article.url,
		isExternalLink: !article.hasContent,
		unreadClass: article.isUnread ? " queue-article--unread" : "",
	};
}

interface QueueDisplayModel {
	total: number;
	pluralSuffix: string;
	saveError?: string;
	showUrl: boolean;
	isEmpty: boolean;
	hasArticles: boolean;
	articles: ArticleDisplayModel[];
	filterAllClass: string;
	filterUnreadClass: string;
	filterReadClass: string;
	filterArchivedClass: string;
	filterAllUrl: string;
	filterUnreadUrl: string;
	filterReadUrl: string;
	filterArchivedUrl: string;
	showUrlToggleUrl: string;
	showUrlToggleLabel: string;
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

function toQueueDisplayModel(vm: QueueViewModel): QueueDisplayModel {
	const activeStatus = vm.filters.status;
	const nextOrder = vm.filters.order === "desc" ? "asc" : "desc";
	const sortLabel = vm.filters.order === "desc" ? "Newest first ↓" : "Oldest first ↑";
	const sortUrl = `/queue?order=${nextOrder}${activeStatus ? `&status=${activeStatus}` : ""}`;

	return {
		total: vm.total,
		pluralSuffix: vm.total !== 1 ? "s" : "",
		saveError: vm.saveError,
		showUrl: vm.filters.showUrl === true,
		isEmpty: vm.isEmpty,
		hasArticles: !vm.isEmpty,
		articles: vm.articles.map(toArticleDisplayModel),
		filterAllClass: filterLinkClass(!activeStatus),
		filterUnreadClass: filterLinkClass(activeStatus === "unread"),
		filterReadClass: filterLinkClass(activeStatus === "read"),
		filterArchivedClass: filterLinkClass(activeStatus === "archived"),
		filterAllUrl: vm.filterUrls.all,
		filterUnreadUrl: vm.filterUrls.unread,
		filterReadUrl: vm.filterUrls.read,
		filterArchivedUrl: vm.filterUrls.archived,
		showUrlToggleUrl: vm.showUrlToggle.url,
		showUrlToggleLabel: vm.showUrlToggle.label,
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

const QUEUE_TEMPLATE = `
    <main class="queue">
      <div class="queue__header">
        <h1 class="queue__title">My Queue</h1>
        <span class="queue__count" data-test-article-count>{{total}} article{{pluralSuffix}}</span>
      </div>
      <form class="queue__save-form" method="POST" action="/queue/save" data-test-form="save-article">
        <input class="queue__save-input" type="url" name="url" placeholder="Paste a URL to save an article…" required>
        <button class="queue__save-btn" type="submit">Save</button>
      </form>
      {{#if saveError}}<p class="queue__save-error" data-test-save-error>{{saveError}}</p>{{/if}}
      <nav class="queue__filters" data-test-filters>
        <a class="{{filterAllClass}}" href="{{filterAllUrl}}">All</a>
        <a class="{{filterUnreadClass}}" href="{{filterUnreadUrl}}">Unread</a>
        <a class="{{filterReadClass}}" href="{{filterReadUrl}}">Read</a>
        <a class="{{filterArchivedClass}}" href="{{filterArchivedUrl}}">Archived</a>
      </nav>
      <div class="queue__sort">
        <a class="queue__sort-link" href="{{showUrlToggleUrl}}" data-test-show-url>{{showUrlToggleLabel}}</a>
        <a class="queue__sort-link" href="{{sortUrl}}" data-test-sort>{{sortLabel}}</a>
      </div>
      {{#if isEmpty}}
      <div class="queue__empty" data-test-empty-queue>
        <h2 class="queue__empty-title">Your queue is empty</h2>
        <p class="queue__empty-text">Paste a URL above to save your first article.</p>
      </div>
      {{/if}}
      {{#if hasArticles}}
      <div class="queue__list" data-test-article-list>
        {{#each articles}}
        <div class="queue-article{{unreadClass}}" data-test-article="{{id}}" data-article-id="{{id}}">
          {{#if imageUrl}}<img class="queue-article__thumbnail" src="{{imageUrl}}" alt="" loading="lazy">{{/if}}
          <div class="queue-article__content">
            <div class="queue-article__title-row">
              {{#if isUnread}}<span class="queue-article__unread-dot" aria-label="Unread"></span>{{/if}}
              <a class="queue-article__title" href="{{linkUrl}}"{{#if isExternalLink}} target="_blank" rel="noopener"{{/if}} data-test-article-title>{{title}}</a>
            </div>
            {{#if ../showUrl}}<span class="queue-article__url" data-test-article-url>{{url}}</span>{{/if}}
            <div class="queue-article__meta">
              <span>{{siteName}}</span>
              <span>{{readTimeLabel}}</span>
              <span>{{savedAgo}}</span>
            </div>
            <p class="queue-article__excerpt">{{excerpt}}</p>
          </div>
          <div class="queue-article__actions">
            {{#if showMarkRead}}
            <form method="POST" action="/queue/{{id}}/status" style="display:inline">
              <input type="hidden" name="status" value="read">
              <button class="queue-article__action-btn" type="submit" title="Mark as read">Read</button>
            </form>
            {{/if}}
            {{#if showMarkUnread}}
            <form method="POST" action="/queue/{{id}}/status" style="display:inline">
              <input type="hidden" name="status" value="unread">
              <button class="queue-article__action-btn" type="submit" title="Mark as unread">Unread</button>
            </form>
            {{/if}}
            {{#if showArchive}}
            <form method="POST" action="/queue/{{id}}/status" style="display:inline">
              <input type="hidden" name="status" value="archived">
              <button class="queue-article__action-btn" type="submit" title="Archive">Archive</button>
            </form>
            {{/if}}
            <form method="POST" action="/queue/{{id}}/delete" style="display:inline">
              <button class="queue-article__action-btn queue-article__action-btn--delete" type="submit" title="Delete" data-test-action="delete">×</button>
            </form>
          </div>
        </div>
        {{/each}}
      </div>
      {{/if}}
      {{#if showPagination}}
      <nav class="queue__pagination" data-test-pagination>
        {{#if hasPrev}}<a class="queue__pagination-link" href="{{prevUrl}}">← Previous</a>{{/if}}
        <span class="queue__pagination-info">Page {{currentPage}} of {{totalPages}}</span>
        {{#if hasNext}}<a class="queue__pagination-link" href="{{nextUrl}}">Next →</a>{{/if}}
      </nav>
      {{/if}}
    </main>`;

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
		scripts: MARK_READ_ON_CLICK_SCRIPT,
		isAuthenticated: true,
	});
}
