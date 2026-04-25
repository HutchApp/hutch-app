import type {
	ArticleMetadata,
	Minutes,
} from "../../../domain/article/article.types";
import type { ArticleCrawl } from "../../../providers/article-crawl/article-crawl.types";
import type { GeneratedSummary } from "../../../providers/article-summary/article-summary.types";
import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { renderArticleBody } from "../../shared/article-body/article-body.component";
import type { ProgressTick } from "../../shared/article-body/progress-mapping";
import { RECRAWL_STYLES } from "./recrawl.styles";

const PROGRESS_BAR_SCRIPT = `<script src="/client-dist/progress-bar.client.js" defer></script>`;

export interface AdminRecrawlPageInput {
	articleUrl: string;
	metadata: ArticleMetadata;
	estimatedReadTime: Minutes;
	content?: string;
	crawl?: ArticleCrawl;
	readerPollUrl?: string;
	crawlProgress?: ProgressTick;
	summary?: GeneratedSummary;
	summaryPollUrl?: string;
	summaryProgress?: ProgressTick;
	isAuthenticated: boolean;
}

/**
 * Admin recrawl page. Renders the same article-body used by /view (title,
 * meta, summary slot, reader slot, poll-based reveal), but intentionally
 * drops the /view clutter — share balloon, CTA actions. Admin pages are
 * noindex/nofollow and served Cache-Control: no-store by the handler.
 */
export function AdminRecrawlPage(input: AdminRecrawlPageInput): Component {
	const innerContent = renderArticleBody({
		title: input.metadata.title,
		siteName: input.metadata.siteName,
		estimatedReadTime: input.estimatedReadTime,
		url: input.articleUrl,
		content: input.content,
		crawl: input.crawl,
		readerPollUrl: input.readerPollUrl,
		crawlProgress: input.crawlProgress,
		summary: input.summary,
		summaryPollUrl: input.summaryPollUrl,
		summaryProgress: input.summaryProgress,
		summaryOpen: true,
	});

	const content = `<main class="admin-recrawl" data-test-admin-recrawl><article class="admin-recrawl__body">${innerContent}</article></main>`;

	return Base({
		seo: {
			title: `Admin recrawl: ${input.metadata.title}`,
			description: "Operator recrawl view. Not for public consumption.",
			canonicalUrl: `/admin/recrawl/${encodeURIComponent(input.articleUrl)}`,
			robots: "noindex, nofollow",
		},
		styles: RECRAWL_STYLES,
		bodyClass: "page-admin-recrawl",
		content,
		scripts: PROGRESS_BAR_SCRIPT,
		isAuthenticated: input.isAuthenticated,
	});
}
