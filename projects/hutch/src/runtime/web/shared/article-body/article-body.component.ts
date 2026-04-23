import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Minutes } from "../../../domain/article/article.types";
import type { ArticleCrawl } from "../../../providers/article-crawl/article-crawl.types";
import type { GeneratedSummary } from "../../../providers/article-summary/article-summary.types";
import { requireEnv } from "../../../require-env";
import { render } from "../../render";
import { renderReaderSlot } from "./reader-slot/reader-slot.component";
import { renderSummarySlot } from "./summary-slot/summary-slot.component";

const STATIC_BASE_URL = requireEnv("STATIC_BASE_URL");

const ARTICLE_BODY_TEMPLATE = readFileSync(
	join(__dirname, "article-body.template.html"),
	"utf-8",
);

export interface ArticleBodyInput {
	title: string;
	siteName: string;
	estimatedReadTime: Minutes;
	url: string;
	content?: string;
	crawl?: ArticleCrawl;
	readerPollUrl?: string;
	summary?: GeneratedSummary;
	summaryPollUrl?: string;
	summaryOpen?: boolean;
	audioEnabled?: boolean;
	backLink?: { href: string; label: string };
}

export function renderArticleBody(input: ArticleBodyInput): string {
	const readerSlotHtml = renderReaderSlot({
		crawl: input.crawl,
		content: input.content,
		url: input.url,
		readerPollUrl: input.readerPollUrl,
	});

	// Summary makes no sense while the article body is unfetched. Hide the slot
	// during pending/failed crawl so users don't see a phantom "Generating
	// summary…" indicator alongside a missing or failed reader view.
	const summarySlotHtml = isCrawlReady(input)
		? renderSummarySlot({
				summary: input.summary,
				summaryPollUrl: input.summaryPollUrl,
				summaryOpen: input.summaryOpen,
			})
		: "";

	return render(ARTICLE_BODY_TEMPLATE, {
		title: input.title,
		siteName: input.siteName,
		estimatedReadTime: input.estimatedReadTime,
		url: input.url,
		readerSlotHtml,
		summarySlotHtml,
		audioEnabled: input.audioEnabled,
		backLink: input.backLink,
		staticBaseUrl: STATIC_BASE_URL,
	});
}

function isCrawlReady(input: ArticleBodyInput): boolean {
	if (input.crawl?.status === "pending" || input.crawl?.status === "failed") {
		return false;
	}
	// Explicit ready, or a legacy row with no crawl status — defer to whether
	// the body content is actually present.
	return Boolean(input.content);
}
