import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SavedArticle } from "../../../domain/article/article.types";
import type { ArticleCrawl } from "../../../providers/article-crawl/article-crawl.types";
import type { GeneratedSummary } from "../../../providers/article-summary/article-summary.types";
import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { render } from "../../render";
import { renderArticleBody } from "../../shared/article-body/article-body.component";
import { READER_STYLES } from "./reader.styles";

const READER_TEMPLATE = readFileSync(join(__dirname, "reader.template.html"), "utf-8");

export function ReaderPage(
	article: SavedArticle,
	options?: {
		emailVerified?: boolean;
		summary?: GeneratedSummary;
		summaryPollUrl?: string;
		crawl?: ArticleCrawl;
		readerPollUrl?: string;
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
		summary: options?.summary,
		summaryPollUrl: options?.summaryPollUrl,
		audioEnabled: options?.audioEnabled,
		backLink: { href: "/queue", label: "← Back to queue" },
	});
	const content = render(READER_TEMPLATE, { innerContent });

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
		isAuthenticated: true,
		emailVerified: options?.emailVerified,
	});
}
