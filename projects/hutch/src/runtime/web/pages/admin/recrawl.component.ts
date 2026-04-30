import type {
	ArticleMetadata,
	Minutes,
} from "../../../domain/article/article.types";
import type { ArticleCrawl } from "../../../providers/article-crawl/article-crawl.types";
import type { GeneratedSummary } from "../../../providers/article-summary/article-summary.types";
import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { renderArticleBody } from "../../shared/article-body/article-body.component";
import { RECRAWL_STYLES } from "./recrawl.styles";

export interface AdminRecrawlPageInput {
	articleUrl: string;
	metadata: ArticleMetadata;
	estimatedReadTime: Minutes;
	content?: string;
	crawl?: ArticleCrawl;
	readerPollUrl?: string;
	summary?: GeneratedSummary;
	summaryPollUrl?: string;
	contentSourceTier?: "tier-0" | "tier-1";
	isAuthenticated: boolean;
}

/**
 * Admin recrawl page. Renders the same article-body used by /view (title,
 * meta, summary slot, reader slot, poll-based reveal), but intentionally
 * drops the /view clutter — share balloon, CTA actions. Admin pages are
 * noindex/nofollow and served Cache-Control: no-store by the handler.
 *
 * The tier badge surfaces which tier won the most recent selector contest
 * so an operator can see, after a recrawl, whether the AI selector kept the
 * extension-captured Tier 0 source over the freshly-fetched Tier 1 (e.g.
 * when the origin is paywalled and the HTTP path produced inferior content).
 * Rows written before the selector existed have no `contentSourceTier`
 * column and surface as "(legacy)".
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
		summary: input.summary,
		summaryPollUrl: input.summaryPollUrl,
		summaryOpen: true,
	});

	const tierBadge = renderTierBadge(input.contentSourceTier);
	const content = `<main class="admin-recrawl" data-test-admin-recrawl>${tierBadge}<article class="admin-recrawl__body">${innerContent}</article></main>`;

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
		isAuthenticated: input.isAuthenticated,
	});
}

function renderTierBadge(tier: "tier-0" | "tier-1" | undefined): string {
	if (tier === "tier-0") {
		return `<div class="admin-recrawl__tier-badge" data-test-tier-badge="tier-0">Showing Tier 0 (extension capture)</div>`;
	}
	if (tier === "tier-1") {
		return `<div class="admin-recrawl__tier-badge" data-test-tier-badge="tier-1">Showing Tier 1 (HTTP crawl)</div>`;
	}
	return `<div class="admin-recrawl__tier-badge admin-recrawl__tier-badge--legacy" data-test-tier-badge="legacy">Showing Tier 1 (legacy)</div>`;
}
