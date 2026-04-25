import type { Component } from "../../component.types";
import { HtmlPage } from "../../html-page";
import {
	CRAWL_STAGE_TO_PCT,
	type CrawlStage,
	DEFAULT_CRAWL_STAGE,
	DEFAULT_SUMMARY_STAGE,
	type ProgressTick,
	SUMMARY_STAGE_TO_PCT,
	type SummaryStage,
} from "../article-body/progress-mapping";
import { renderReaderSlot } from "../article-body/reader-slot/reader-slot.component";
import { renderSummarySlot } from "../article-body/summary-slot/summary-slot.component";
import type { ArticleCrawl } from "../../../providers/article-crawl/article-crawl.types";
import type { GeneratedSummary } from "../../../providers/article-summary/article-summary.types";
import type {
	ArticleReaderDeps,
	HandlePollParams,
	ReaderState,
	ResolveReaderStateParams,
} from "./article-reader.types";

const MAX_POLLS = 40;

function buildCrawlProgress(
	crawl: ArticleCrawl | undefined,
	now: Date,
): ProgressTick | undefined {
	if (crawl?.status !== "pending") return undefined;
	const stage: CrawlStage = crawl.stage ?? DEFAULT_CRAWL_STAGE;
	return { stage, pct: CRAWL_STAGE_TO_PCT[stage], tickAt: now.toISOString() };
}

function buildSummaryProgress(
	crawl: ArticleCrawl | undefined,
	summary: GeneratedSummary | undefined,
	now: Date,
): ProgressTick | undefined {
	// Crawl-failed collapses the summary slot to skipped — no bar rendered.
	if (crawl?.status === "failed") return undefined;
	if (summary !== undefined && summary.status !== "pending") return undefined;
	const recordedStage =
		summary?.status === "pending" ? summary.stage : undefined;
	const stage: SummaryStage = recordedStage ?? DEFAULT_SUMMARY_STAGE;
	return { stage, pct: SUMMARY_STAGE_TO_PCT[stage], tickAt: now.toISOString() };
}

export function initArticleReader(deps: ArticleReaderDeps): {
	resolveReaderState: (params: ResolveReaderStateParams) => Promise<ReaderState>;
	handleSummaryPoll: (params: HandlePollParams) => Promise<Component>;
	handleReaderPoll: (params: HandlePollParams) => Promise<Component>;
} {
	async function resolveReaderState(
		params: ResolveReaderStateParams,
	): Promise<ReaderState> {
		const { article, pollUrlBuilder } = params;
		let crawl = await deps.findArticleCrawlStatus(article.url);
		let summary = await deps.findGeneratedSummary(article.url);

		// Legacy-stub healing: a row that exists but carries neither a crawl nor a
		// summary state attribute pre-dates the state machines. Re-prime both so it
		// reaches a terminal state instead of sitting on "Generating summary…"
		// forever on every render. Re-read so the same request picks up any state
		// the synchronous in-memory worker wrote during priming (real workers are
		// async; the re-read just surfaces whatever is durable now).
		if (crawl === undefined && summary === undefined) {
			await deps.markCrawlPending({ url: article.url });
			await deps.markSummaryPending({ url: article.url });
			crawl = await deps.findArticleCrawlStatus(article.url);
			summary = await deps.findGeneratedSummary(article.url);
		}

		const content = await deps.readArticleContent(article.url);
		const summaryStatus = summary?.status ?? "pending";
		const summaryPollUrl = summaryStatus === "pending"
			? pollUrlBuilder.summary(1)
			: undefined;
		const readerPollUrl = crawl?.status === "pending"
			? pollUrlBuilder.reader(1)
			: undefined;

		const now = deps.now();
		return {
			content,
			crawl,
			summary,
			readerPollUrl,
			summaryPollUrl,
			crawlProgress: buildCrawlProgress(crawl, now),
			summaryProgress: buildSummaryProgress(crawl, summary, now),
		};
	}

	async function handleSummaryPoll(params: HandlePollParams): Promise<Component> {
		const { articleUrl, pollCount, pollUrlBuilder } = params;
		const crawl = await deps.findArticleCrawlStatus(articleUrl);
		const summary = await deps.findGeneratedSummary(articleUrl);
		const crawlFailed = crawl?.status === "failed";
		const status = summary?.status ?? "pending";
		const summaryPollUrl = !crawlFailed && status === "pending" && pollCount < MAX_POLLS
			? pollUrlBuilder.summary(pollCount + 1)
			: undefined;
		return HtmlPage(
			renderSummarySlot({
				crawl,
				summary,
				summaryPollUrl,
				summaryOpen: true,
				summaryProgress: buildSummaryProgress(crawl, summary, deps.now()),
			}),
		);
	}

	async function handleReaderPoll(params: HandlePollParams): Promise<Component> {
		const { articleUrl, pollCount, pollUrlBuilder } = params;
		const crawl = await deps.findArticleCrawlStatus(articleUrl);
		const content = await deps.readArticleContent(articleUrl);
		const readerPollUrl = crawl?.status === "pending" && pollCount < MAX_POLLS
			? pollUrlBuilder.reader(pollCount + 1)
			: undefined;
		return HtmlPage(
			renderReaderSlot({
				crawl,
				content,
				url: articleUrl,
				readerPollUrl,
				crawlProgress: buildCrawlProgress(crawl, deps.now()),
			}),
		);
	}

	return { resolveReaderState, handleSummaryPoll, handleReaderPoll };
}
