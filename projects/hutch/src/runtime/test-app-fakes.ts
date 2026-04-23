import { ArticleResourceUniqueId } from "@packages/article-resource-unique-id";
import type { CrawlArticle } from "@packages/crawl-article";
import { noopLogger } from "@packages/hutch-logger";
import { calculateReadTime } from "./domain/article/estimated-read-time";
import type {
	ParseArticle,
} from "./providers/article-parser/article-parser.types";
import { initReadabilityParser } from "./providers/article-parser/readability-parser";
import type { initInMemoryArticleCrawl } from "./providers/article-crawl/in-memory-article-crawl";
import type { initInMemoryArticleStore } from "./providers/article-store/in-memory-article-store";
import type { RefreshArticleIfStale } from "./providers/article-freshness/check-content-freshness";
import type {
	FindGeneratedSummary,
	GeneratedSummary,
	MarkSummaryPending,
} from "./providers/article-summary/article-summary.types";
import { initInMemoryLinkSaved } from "./providers/events/in-memory-link-saved";
import { initInMemorySaveAnonymousLink } from "./providers/events/in-memory-save-anonymous-link";
import { initInMemoryUpdateFetchTimestamp } from "./providers/events/in-memory-update-fetch-timestamp";
import type { PublishLinkSaved } from "./providers/events/publish-link-saved.types";
import type { PublishSaveAnonymousLink } from "./providers/events/publish-save-anonymous-link.types";

export { httpErrorMessageMapping as defaultHttpErrorMessageMapping } from "./web/pages/queue/queue.error";
export { initReadabilityParser };

export const TEST_APP_ORIGIN = "http://localhost:3000";

export const stubCrawlArticle: CrawlArticle = async ({ url }) => {
	const hostname = new URL(url).hostname;
	return {
		status: "fetched",
		html: `<html><head><title>Article from ${hostname}</title></head><body><article><p>Content saved from ${hostname}.</p></article></body></html>`,
	};
};

export const createNoopRefreshArticleIfStale = (): RefreshArticleIfStale =>
	async () => ({ action: "new" });

export const createInMemoryPublishUpdateFetchTimestamp = () =>
	initInMemoryUpdateFetchTimestamp({ logger: noopLogger }).publishUpdateFetchTimestamp;

export const createNoopLogError = (): ((msg: string, err?: Error) => void) =>
	() => {};

export function createFakeSummaryProvider(): {
	findGeneratedSummary: FindGeneratedSummary;
	markSummaryPending: MarkSummaryPending;
} {
	// Test-only fake for the Deepseek-backed summary generation. Local E2E
	// doesn't call a real LLM, so we simulate the pending → ready transition
	// with a short setTimeout — long enough that the UI briefly shows the
	// "Generating summary…" indicator so HTMX polling is exercised end-to-end,
	// short enough to finish well inside Playwright's default test timeout.
	const state = new Map<string, GeneratedSummary>();
	const READY_DELAY_MS = 500;
	const findGeneratedSummary: FindGeneratedSummary = async (url) => {
		const id = ArticleResourceUniqueId.parse(url).value;
		return state.get(id);
	};
	const markSummaryPending: MarkSummaryPending = async ({ url }) => {
		const id = ArticleResourceUniqueId.parse(url).value;
		if (state.get(id)?.status === "ready") return;
		state.set(id, { status: "pending" });
		setTimeout(() => {
			state.set(id, { status: "ready", summary: `Fake summary for ${url}.` });
		}, READY_DELAY_MS).unref();
	};
	return { findGeneratedSummary, markSummaryPending };
}

export function createFakeApplyParseResult(deps: {
	articleStore: ReturnType<typeof initInMemoryArticleStore>;
	articleCrawl: ReturnType<typeof initInMemoryArticleCrawl>;
	parseArticle: ParseArticle;
}): (url: string) => Promise<void> {
	// Test-only fixture for the async crawl worker: parses (using the injected
	// parseArticle so test cases can simulate parse failures or specific
	// metadata), writes parsed metadata + content, then flips crawlStatus
	// before the awaited publish returns. This makes the route test render
	// the post-worker state in a single synchronous request.
	return async (url) => {
		const result = await deps.parseArticle(url);
		if (!result.ok) {
			await deps.articleCrawl.markCrawlFailed({ url, reason: result.reason });
			return;
		}
		const estimatedReadTime = calculateReadTime(result.article.wordCount);
		await deps.articleStore.writeMetadata({
			url,
			metadata: {
				title: result.article.title,
				siteName: result.article.siteName,
				excerpt: result.article.excerpt,
				wordCount: result.article.wordCount,
				...(result.article.imageUrl ? { imageUrl: result.article.imageUrl } : {}),
			},
			estimatedReadTime,
		});
		await deps.articleStore.writeContent({ url, content: result.article.content });
		await deps.articleCrawl.markCrawlReady({ url });
	};
}

export function createFakePublishLinkSaved(
	applyParseResult: (url: string) => Promise<void>,
): PublishLinkSaved {
	const { publishLinkSaved: log } = initInMemoryLinkSaved({ logger: noopLogger });
	return async (params) => {
		await log(params);
		await applyParseResult(params.url);
	};
}

export function createFakePublishSaveAnonymousLink(
	applyParseResult: (url: string) => Promise<void>,
): PublishSaveAnonymousLink {
	const { publishSaveAnonymousLink: log } = initInMemorySaveAnonymousLink({ logger: noopLogger });
	return async (params) => {
		await log(params);
		await applyParseResult(params.url);
	};
}
