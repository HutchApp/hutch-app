import { ArticleResourceUniqueId } from "@packages/article-resource-unique-id";
import type { CrawlArticle } from "@packages/crawl-article";
import { noopLogger } from "@packages/hutch-logger";
import { calculateReadTime } from "./domain/article/estimated-read-time";
import type {
	ParseArticle,
} from "./providers/article-parser/article-parser.types";
import { initReadabilityParser } from "./providers/article-parser/readability-parser";
import { initInMemoryArticleCrawl } from "./providers/article-crawl/in-memory-article-crawl";
import { initInMemoryArticleStore } from "./providers/article-store/in-memory-article-store";
import { initInMemoryAuth } from "./providers/auth/in-memory-auth";
import { initInMemoryEmail } from "./providers/email/in-memory-email";
import { initInMemoryEmailVerification } from "./providers/email-verification/in-memory-email-verification";
import { initInMemoryPasswordReset } from "./providers/password-reset/in-memory-password-reset";
import { initInMemoryPendingHtml } from "./providers/pending-html/in-memory-pending-html";
import { initInMemorySaveLinkRawHtmlCommand } from "./providers/events/in-memory-save-link-raw-html-command";
import {
	createOAuthModel,
	initInMemoryOAuthModel,
} from "./providers/oauth/oauth-model";
import { createValidateAccessToken } from "./providers/oauth/validate-access-token";
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
import { httpErrorMessageMapping } from "./web/pages/queue/queue.error";
import type { TestAppFixture } from "./test-app";

export { initReadabilityParser };

/* c8 ignore next -- V8 block-coverage phantom: the const initializer for the first
   `export const arrowFn` in this module is reported as an uncovered function even
   though every test exercises it. See https://github.com/bcoe/c8/issues/319 and
   https://v8.dev/blog/javascript-code-coverage. */
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

export function createFakeSummaryProvider(opts?: { readyAfterReads?: number }): {
	findGeneratedSummary: FindGeneratedSummary;
	markSummaryPending: MarkSummaryPending;
} {
	// Test-only fake for the Deepseek-backed summary generation. Local E2E
	// doesn't call a real LLM, so we simulate the pending → ready transition
	// by counting reads of a pending row and flipping it once the count hits
	// readyAfterReads. Default (no opts) = stays pending forever, so unit/route
	// tests get deterministic HTML. E2E opts in (e.g. readyAfterReads: 3) to
	// exercise the polling UI end-to-end without depending on wall-clock time.
	const state = new Map<string, GeneratedSummary>();
	const reads = new Map<string, number>();
	const findGeneratedSummary: FindGeneratedSummary = async (url) => {
		const id = ArticleResourceUniqueId.parse(url).value;
		const current = state.get(id);
		if (opts?.readyAfterReads !== undefined && current?.status === "pending") {
			const count = (reads.get(id) ?? 0) + 1;
			reads.set(id, count);
			if (count >= opts.readyAfterReads) {
				state.set(id, { status: "ready", summary: `Fake summary for ${url}.` });
			}
		}
		return state.get(id);
	};
	const markSummaryPending: MarkSummaryPending = async ({ url }) => {
		const id = ArticleResourceUniqueId.parse(url).value;
		if (state.get(id)?.status === "ready") return;
		state.set(id, { status: "pending" });
		reads.set(id, 0);
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

export const TEST_APP_ORIGIN = "http://localhost:3000";

export function createDefaultTestAppFixture(appOrigin: string): TestAppFixture {

	const auth = initInMemoryAuth();
	const articleStoreMemory = initInMemoryArticleStore();
	const articleCrawl = initInMemoryArticleCrawl();
	const crawlArticle = stubCrawlArticle;
	const { parseArticle } = initReadabilityParser({
		crawlArticle,
		sitePreParsers: [],
		logError: createNoopLogError(),
	});
	const applyParseResult = createFakeApplyParseResult({
		articleStore: articleStoreMemory,
		articleCrawl,
		parseArticle,
	});
	const summary = createFakeSummaryProvider();
	const email = initInMemoryEmail();
	const emailVerification = initInMemoryEmailVerification();
	const passwordReset = initInMemoryPasswordReset();
	const pendingHtml = initInMemoryPendingHtml();
	const { publishSaveLinkRawHtmlCommand } = initInMemorySaveLinkRawHtmlCommand({
		logger: noopLogger,
	});
	const oauthModel = createOAuthModel(initInMemoryOAuthModel(), { appOrigin });

	return {
		auth,
		articleStore: {
			findArticleById: articleStoreMemory.findArticleById,
			findArticleByUrl: articleStoreMemory.findArticleByUrl,
			findArticleFreshness: articleStoreMemory.findArticleFreshness,
			findArticlesByUser: articleStoreMemory.findArticlesByUser,
			saveArticle: articleStoreMemory.saveArticle,
			saveArticleGlobally: articleStoreMemory.saveArticleGlobally,
			deleteArticle: articleStoreMemory.deleteArticle,
			updateArticleStatus: articleStoreMemory.updateArticleStatus,
			readArticleContent: (url) =>
				articleStoreMemory.readContent(ArticleResourceUniqueId.parse(url)),
			readContent: articleStoreMemory.readContent,
			writeContent: articleStoreMemory.writeContent,
			writeMetadata: articleStoreMemory.writeMetadata,
		},
		articleCrawl: {
			findArticleCrawlStatus: articleCrawl.findArticleCrawlStatus,
			markCrawlPending: articleCrawl.markCrawlPending,
			forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
			markCrawlReady: articleCrawl.markCrawlReady,
			markCrawlFailed: articleCrawl.markCrawlFailed,
		},
		parser: { parseArticle, crawlArticle },
		events: {
			publishLinkSaved: createFakePublishLinkSaved(applyParseResult),
			publishSaveAnonymousLink: createFakePublishSaveAnonymousLink(applyParseResult),
			publishSaveLinkRawHtmlCommand,
			publishUpdateFetchTimestamp: createInMemoryPublishUpdateFetchTimestamp(),
		},
		pendingHtml: {
			putPendingHtml: pendingHtml.putPendingHtml,
			readPendingHtml: pendingHtml.readPendingHtml,
		},
		summary,
		freshness: { refreshArticleIfStale: createNoopRefreshArticleIfStale() },
		oauth: {
			oauthModel,
			validateAccessToken: createValidateAccessToken(oauthModel),
		},
		email,
		emailVerification,
		passwordReset,
		google: undefined,
		admin: {
			adminEmails: [],
			recrawlServiceToken: "test-service-token-abcdefghij",
		},
		shared: {
			appOrigin,
			httpErrorMessageMapping,
			logError: createNoopLogError(),
			logParseError: () => {},
		},
	};
}
