import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { render } from "../../render";
import { QUEUE_STYLES } from "./queue.styles";
import type { QueueArticleViewModel, QueueViewModel } from "./queue.viewmodel";

const QUEUE_TEMPLATE = readFileSync(join(__dirname, "queue.template.html"), "utf-8");

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
		scripts: MARK_READ_ON_CLICK_SCRIPT,
		isAuthenticated: true,
		emailVerified: options?.emailVerified,
	});
}
