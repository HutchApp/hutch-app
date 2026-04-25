import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SavedArticle } from "../../../domain/article/article.types";
import type { ArticleCrawl } from "../../../providers/article-crawl/article-crawl.types";
import type { GeneratedSummary } from "../../../providers/article-summary/article-summary.types";
import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { render } from "../../render";
import { renderArticleBody } from "../../shared/article-body/article-body.component";
import type { ProgressTick } from "../../shared/article-body/progress-mapping";
import {
	SHARE_BALLOON_SCRIPT,
	renderShareBalloon,
} from "../../shared/share-balloon/share-balloon.component";
import { READER_STYLES } from "./reader.styles";

const CANONICAL_BASE_URL = "https://readplace.com";

const READER_TEMPLATE = readFileSync(join(__dirname, "reader.template.html"), "utf-8");
const PROGRESS_BAR_SCRIPT = `<script src="/client-dist/progress-bar.client.js" defer></script>`;

export function ReaderPage(
	article: SavedArticle,
	options?: {
		emailVerified?: boolean;
		summary?: GeneratedSummary;
		summaryPollUrl?: string;
		summaryProgress?: ProgressTick;
		crawl?: ArticleCrawl;
		readerPollUrl?: string;
		crawlProgress?: ProgressTick;
		audioEnabled?: boolean;
	},
): Component {
	const innerContent = renderArticleBody({
		title: article.metadata.title,
		siteName: article.metadata.siteName,
		estimatedReadTime: article.estimatedReadTime,
		url: article.url,
		content: article.content,
		crawl: options?.crawl,
		readerPollUrl: options?.readerPollUrl,
		crawlProgress: options?.crawlProgress,
		summary: options?.summary,
		summaryPollUrl: options?.summaryPollUrl,
		summaryProgress: options?.summaryProgress,
		summaryOpen: true,
		audioEnabled: options?.audioEnabled,
		backLink: { href: "/queue", label: "← Back to queue" },
	});
	const shareBalloon = renderShareBalloon({
		shareUrl: `${CANONICAL_BASE_URL}/view/${encodeURIComponent(article.url)}`,
		shareTitle: article.metadata.title,
		shareHint: "Click here to share this post!",
	});
	const content = render(READER_TEMPLATE, { innerContent, shareBalloon });

	return Base({
		seo: {
			title: `${article.metadata.title} — Readplace Reader`,
			description: article.metadata.excerpt,
			canonicalUrl: `/queue/${article.id.value}/read`,
			robots: "noindex, nofollow",
		},
		styles: READER_STYLES,
		bodyClass: "page-reader",
		content,
		scripts: SHARE_BALLOON_SCRIPT + PROGRESS_BAR_SCRIPT,
		isAuthenticated: true,
		emailVerified: options?.emailVerified,
	});
}
