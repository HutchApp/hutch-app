import type { Component } from "../../component.types";
import { HtmlPage } from "../../html-page";
import { renderReaderSlot } from "../article-body/reader-slot/reader-slot.component";
import { renderSummarySlot } from "../article-body/summary-slot/summary-slot.component";
import type {
	ArticleReaderDeps,
	HandlePollParams,
	ReaderState,
	ResolveReaderStateParams,
} from "./article-reader.types";

const MAX_POLLS = 40;

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
		// Poll while the crawl is pending, and also when crawl is undefined with
		// no content yet — that combination is usually a read-after-write race
		// where markCrawlPending hasn't propagated, so polling lets the slot
		// recover once the next read sees the durable state.
		const shouldPollReader =
			crawl?.status === "pending" || (crawl === undefined && content === undefined);
		const readerPollUrl = shouldPollReader ? pollUrlBuilder.reader(1) : undefined;

		return { content, crawl, summary, readerPollUrl, summaryPollUrl };
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
		return HtmlPage(renderSummarySlot({ crawl, summary, summaryPollUrl, summaryOpen: true }));
	}

	async function handleReaderPoll(params: HandlePollParams): Promise<Component> {
		const { articleUrl, pollCount, pollUrlBuilder } = params;
		const crawl = await deps.findArticleCrawlStatus(articleUrl);
		const content = await deps.readArticleContent(articleUrl);
		const shouldPollReader =
			crawl?.status === "pending" || (crawl === undefined && content === undefined);
		const readerPollUrl = shouldPollReader && pollCount < MAX_POLLS
			? pollUrlBuilder.reader(pollCount + 1)
			: undefined;
		return HtmlPage(renderReaderSlot({ crawl, content, url: articleUrl, readerPollUrl }));
	}

	return { resolveReaderState, handleSummaryPoll, handleReaderPoll };
}
