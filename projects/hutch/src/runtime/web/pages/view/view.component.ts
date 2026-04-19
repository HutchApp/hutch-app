import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
	ArticleMetadata,
	Minutes,
} from "../../../domain/article/article.types";
import type { GeneratedSummary } from "../../../providers/article-summary/article-summary.types";
import { requireEnv } from "../../../require-env";
import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { render } from "../../render";
import { renderArticleBody } from "../../shared/article-body/article-body.component";
import { SHARE_ICON_SVG } from "./view.share-icon";
import { VIEW_STYLES } from "./view.styles";

const SHARE_SCRIPT = `<script>
(function() {
  var STORAGE_KEY = 'readplace.share-dismissed';
  // Scroll past this many pixels before scheduling the open — proxy for "user is engaged".
  var SCROLL_THRESHOLD_PX = 100;
  // Wait this long after the threshold is crossed before the bubble appears.
  var OPEN_DELAY_MS = 1000;

  var wrap = document.querySelector('[data-view-share-wrap]');
  if (!wrap) return;
  var btn = wrap.querySelector('[data-view-share]');
  var closeBtn = wrap.querySelector('[data-view-share-close]');
  var status = document.querySelector('[data-view-share-status]');

  var url = btn.getAttribute('data-share-url');
  var title = btn.getAttribute('data-share-title');
  var copiedLabel = wrap.querySelector('[data-view-share-copied]');
  var canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  var canCopy = typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function';
  if (!canShare && !canCopy) return;

  wrap.hidden = false;

  var dismissed = false;
  try { dismissed = window.localStorage.getItem(STORAGE_KEY) === '1'; } catch (e) {}

  var openTimerId = null;
  function openBalloon() {
    openTimerId = null;
    wrap.classList.add('view__share-balloon-wrap--open');
  }
  function cancelPendingOpen() {
    if (openTimerId !== null) {
      clearTimeout(openTimerId);
      openTimerId = null;
    }
  }

  function onScroll() {
    if (window.scrollY < SCROLL_THRESHOLD_PX) return;
    window.removeEventListener('scroll', onScroll);
    if (openTimerId === null) {
      openTimerId = setTimeout(openBalloon, OPEN_DELAY_MS);
    }
  }

  if (!dismissed) {
    window.addEventListener('scroll', onScroll, { passive: true });
    // Handle the case where the page is already scrolled past the threshold (e.g., back-forward cache).
    onScroll();
  }

  closeBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    cancelPendingOpen();
    window.removeEventListener('scroll', onScroll);
    wrap.classList.remove('view__share-balloon-wrap--open');
    try { window.localStorage.setItem(STORAGE_KEY, '1'); } catch (e2) {}
  });

  function flashCopied() {
    if (copiedLabel) copiedLabel.classList.add('view__share-balloon-copied--visible');
    if (status) status.textContent = 'Link copied to clipboard';
    setTimeout(function() {
      if (copiedLabel) copiedLabel.classList.remove('view__share-balloon-copied--visible');
      if (status) status.textContent = '';
    }, 3000);
  }

  btn.addEventListener('click', function() {
    if (canCopy) {
      navigator.clipboard.writeText(url).then(flashCopied).catch(function() {
        if (status) status.textContent = 'Unable to copy link';
      });
    }
    if (canShare) {
      navigator.share({ title: title, url: url }).catch(function(err) {
        if (err && err.name === 'AbortError') return;
      });
    }
  });
})();
</script>`;

const STATIC_BASE_URL = requireEnv("STATIC_BASE_URL");
const CANONICAL_BASE_URL = "https://readplace.com";
const DEFAULT_OG_IMAGE = `${STATIC_BASE_URL}/og-image-1200x630.png`;
const DEFAULT_TWITTER_IMAGE = `${STATIC_BASE_URL}/twitter-card-1200x600.png`;
const DEFAULT_OG_ALT = "Readplace — A read-it-later app";
const FOUNDER_AVATAR_URL = `${STATIC_BASE_URL}/fayner-brack.jpg`;

const VIEW_TEMPLATE = readFileSync(
	join(__dirname, "view.template.html"),
	"utf-8",
);

export interface ViewAction {
	name: string;
	href: string;
}

export interface ViewPageInput {
	articleUrl: string;
	metadata: ArticleMetadata;
	estimatedReadTime: Minutes;
	content?: string;
	summary?: GeneratedSummary;
	summaryPollUrl?: string;
	actions: ViewAction[];
}

export function ViewPage(input: ViewPageInput): Component {
	const innerContent = renderArticleBody({
		title: input.metadata.title,
		siteName: input.metadata.siteName,
		estimatedReadTime: input.estimatedReadTime,
		url: input.articleUrl,
		content: input.content,
		summary: input.summary,
		summaryPollUrl: input.summaryPollUrl,
		summaryOpen: true,
	});

	const canonicalViewUrl = `${CANONICAL_BASE_URL}/view/${encodeURIComponent(input.articleUrl)}`;

	const content = render(VIEW_TEMPLATE, {
		innerContent,
		articleUrl: input.articleUrl,
		actions: input.actions,
		shareUrl: canonicalViewUrl,
		shareTitle: input.metadata.title,
		shareIconSvg: SHARE_ICON_SVG,
		founderAvatarUrl: FOUNDER_AVATAR_URL,
	});

	const ogImage = input.metadata.imageUrl ?? DEFAULT_OG_IMAGE;
	const twitterImage = input.metadata.imageUrl ?? DEFAULT_TWITTER_IMAGE;
	const ogImageAlt = input.metadata.imageUrl
		? input.metadata.title
		: DEFAULT_OG_ALT;
	const description = input.metadata.excerpt || "View on Readplace.";

	const structuredData: Record<string, unknown> = {
		"@context": "https://schema.org",
		"@type": "Article",
		headline: input.metadata.title,
		description: description,
		url: canonicalViewUrl,
		isBasedOn: { "@type": "Article", url: input.articleUrl },
	};
	if (input.metadata.imageUrl) {
		structuredData.image = input.metadata.imageUrl;
	}

	return Base({
		seo: {
			title: `${input.metadata.title} Summary | Readplace`,
			description,
			canonicalUrl: `/view/${encodeURIComponent(input.articleUrl)}`,
			ogType: "article",
			ogImage,
			ogImageAlt,
			twitterImage,
			robots: "index, follow",
			structuredData: [structuredData],
		},
		styles: VIEW_STYLES,
		bodyClass: "page-view",
		content,
		scripts: SHARE_SCRIPT,
		isAuthenticated: false,
	});
}
