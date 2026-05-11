import assert from "node:assert";
import type {
	Article,
	ArticleStore,
	CrawlState,
	Minutes,
	SummaryState,
} from "@packages/domain/article";
import type { FindArticleByUrl } from "../article-store/article-store.types";
import type { ArticleMetadata } from "@packages/domain/article";

export interface BridgeReaders {
	findArticleByUrl: FindArticleByUrl;
	findArticleCrawlStatus: (
		url: string,
	) => Promise<
		| { status: "pending"; stage?: string }
		| { status: "ready" }
		| { status: "failed"; reason: string }
		| { status: "unsupported"; reason: string }
		| undefined
	>;
	findGeneratedSummary: (
		url: string,
	) => Promise<
		| { status: "pending"; stage?: string }
		| { status: "ready"; summary: string; excerpt?: string }
		| { status: "failed"; reason: string }
		| { status: "skipped"; reason?: string }
		| undefined
	>;
}

// Summary-state writers are optional because Phase-1's /admin/recrawl path
// only produces `summary=pending`; Phase-2 DLQ handlers will set the rest.
export interface BridgeWriters {
	forceMarkCrawlPending: (params: { url: string }) => Promise<void>;
	markCrawlReady: (params: { url: string }) => Promise<void>;
	markCrawlFailed: (params: {
		url: string;
		reason: string;
	}) => Promise<void>;
	markCrawlUnsupported: (params: {
		url: string;
		reason: string;
	}) => Promise<void>;
	forceMarkSummaryPending: (params: { url: string }) => Promise<void>;
	markSummaryReady?: (params: {
		url: string;
		summary: string;
		excerpt: string;
	}) => void;
	markSummaryFailed?: (params: { url: string; reason: string }) => Promise<void>;
	markSummarySkipped?: (params: {
		url: string;
		reason?: string;
	}) => Promise<void>;
	writeMetadata: (params: {
		url: string;
		metadata: ArticleMetadata;
		estimatedReadTime: Minutes;
	}) => Promise<void>;
}

/**
 * In-memory aggregate adapter that delegates to the existing per-state
 * test-fixture providers (`articleStore`, `articleCrawl`, `summary`). This
 * is the bridge that lets `/admin/recrawl` and other aggregate-callers run
 * in the test app while existing route tests keep asserting against the
 * legacy fixture methods (e.g. `harness.summary.findGeneratedSummary(...)`
 * still returns the correct projection because the bridge wrote to it).
 */
export function initBridgeArticleStore(deps: {
	readers: BridgeReaders;
	writers: BridgeWriters;
}): ArticleStore {
	async function load(url: string): Promise<Article | undefined> {
		const article = await deps.readers.findArticleByUrl(url);
		if (!article) return undefined;
		const crawlProjection = await deps.readers.findArticleCrawlStatus(url);
		const summaryProjection = await deps.readers.findGeneratedSummary(url);

		const crawl: CrawlState = crawlProjection
			? toCrawl(crawlProjection)
			: { status: "pending" };
		const summary: SummaryState = summaryProjection
			? toSummary(summaryProjection)
			: { status: "pending" };

		return {
			url: article.url,
			crawl,
			summary,
			metadata: article.metadata,
			estimatedReadTime: article.estimatedReadTime,
		};
	}

	async function save(article: Article): Promise<void> {
		await writeCrawl(deps.writers, article);
		await writeSummary(deps.writers, article);
		await deps.writers.writeMetadata({
			url: article.url,
			metadata: article.metadata,
			estimatedReadTime: article.estimatedReadTime,
		});
	}

	return { load, save };
}

function toCrawl(
	projection: NonNullable<
		Awaited<ReturnType<BridgeReaders["findArticleCrawlStatus"]>>
	>,
): CrawlState {
	if (projection.status === "failed") {
		return {
			status: "failed",
			reason: projection.reason,
			failedAt: "",
		};
	}
	if (projection.status === "unsupported") {
		return {
			status: "unsupported",
			reason: projection.reason,
			failedAt: "",
		};
	}
	if (projection.status === "ready") return { status: "ready" };
	return { status: "pending" };
}

function toSummary(
	projection: NonNullable<
		Awaited<ReturnType<BridgeReaders["findGeneratedSummary"]>>
	>,
): SummaryState {
	if (projection.status === "failed") {
		return { status: "failed", reason: projection.reason };
	}
	if (projection.status === "skipped") {
		return projection.reason
			? { status: "skipped", reason: projection.reason }
			: { status: "skipped" };
	}
	if (projection.status === "ready") {
		// The legacy summary fixture doesn't track inputTokens/outputTokens;
		// project them as zero. Aggregate transitions for /admin/recrawl
		// only RESET the summary (never produce a ready state), so the
		// missing counts only surface on read and never round-trip back
		// through the writer side in the test scenarios that use this bridge.
		const ready: SummaryState = {
			status: "ready",
			summary: projection.summary,
			inputTokens: 0,
			outputTokens: 0,
		};
		if (projection.excerpt) ready.excerpt = projection.excerpt;
		return ready;
	}
	return { status: "pending" };
}

async function writeCrawl(
	writers: BridgeWriters,
	article: Article,
): Promise<void> {
	if (article.crawl.status === "pending") {
		await writers.forceMarkCrawlPending({ url: article.url });
		return;
	}
	if (article.crawl.status === "ready") {
		await writers.markCrawlReady({ url: article.url });
		return;
	}
	if (article.crawl.status === "failed") {
		await writers.markCrawlFailed({
			url: article.url,
			reason: article.crawl.reason,
		});
		return;
	}
	await writers.markCrawlUnsupported({
		url: article.url,
		reason: article.crawl.reason,
	});
}

async function writeSummary(
	writers: BridgeWriters,
	article: Article,
): Promise<void> {
	if (article.summary.status === "pending") {
		await writers.forceMarkSummaryPending({ url: article.url });
		return;
	}
	if (article.summary.status === "ready") {
		assert(
			writers.markSummaryReady,
			"bridge: markSummaryReady writer required when transition produces summary=ready",
		);
		writers.markSummaryReady({
			url: article.url,
			summary: article.summary.summary,
			excerpt: article.summary.excerpt ?? "",
		});
		return;
	}
	if (article.summary.status === "failed") {
		assert(
			writers.markSummaryFailed,
			"bridge: markSummaryFailed writer required when transition produces summary=failed",
		);
		await writers.markSummaryFailed({
			url: article.url,
			reason: article.summary.reason,
		});
		return;
	}
	assert(
		writers.markSummarySkipped,
		"bridge: markSummarySkipped writer required when transition produces summary=skipped",
	);
	await writers.markSummarySkipped({
		url: article.url,
		reason: article.summary.reason,
	});
}
