import type {
	ConditionalFetchResult,
	FetchConditional,
	FetchHtmlWithHeaders,
	ParseArticleResult,
	ParseHtml,
} from "../article-parser/article-parser.types";
import type {
	ArticleFreshnessData,
	ClearArticleSummary,
	FindArticleFreshness,
	UpdateArticleContent,
	UpdateArticleFetchMetadata,
} from "../article-store/article-store.types";
import { calculateReadTime } from "../../domain/article/estimated-read-time";
import { fitContent } from "../../domain/article/content-size-guard";

export type ContentFreshnessResult =
	| { action: "new" }
	| { action: "skip" }
	| { action: "unchanged" }
	| { action: "refreshed"; article: ParseArticleResult & { ok: true } };

export type RefreshArticleIfStale = (params: {
	url: string;
}) => Promise<ContentFreshnessResult>;

export function initRefreshArticleIfStale(deps: {
	findArticleFreshness: FindArticleFreshness;
	fetchConditional: FetchConditional;
	fetchHtmlWithHeaders: FetchHtmlWithHeaders;
	parseHtml: ParseHtml;
	updateArticleContent: UpdateArticleContent;
	updateArticleFetchMetadata: UpdateArticleFetchMetadata;
	clearArticleSummary: ClearArticleSummary;
	logError: (message: string, error?: Error) => void;
	now: () => Date;
	staleTtlMs: number;
}): { refreshArticleIfStale: RefreshArticleIfStale } {
	const refreshArticleIfStale: RefreshArticleIfStale = async (params) => {
		const freshness = await deps.findArticleFreshness(params.url);

		if (!freshness) {
			return { action: "new" };
		}

		if (freshness.contentFetchedAt) {
			const fetchedAt = new Date(freshness.contentFetchedAt).getTime();
			const now = deps.now().getTime();
			if (now - fetchedAt < deps.staleTtlMs) {
				return { action: "skip" };
			}
		}

		if (freshness.etag || freshness.lastModified) {
			return handleConditionalFetch(params.url, freshness);
		}

		return handleFullFetch(params.url);
	};

	async function handleConditionalFetch(
		url: string,
		freshness: ArticleFreshnessData,
	): Promise<ContentFreshnessResult> {
		try {
			const result = await deps.fetchConditional({
				url,
				etag: freshness.etag,
				lastModified: freshness.lastModified,
			});

			if (!result.changed) {
				await deps.updateArticleFetchMetadata({
					url,
					contentFetchedAt: deps.now().toISOString(),
				});
				return { action: "unchanged" };
			}

			return handleChangedContent(url, result);
		} catch (error) {
			deps.logError("Conditional fetch failed", error instanceof Error ? error : undefined);
			return { action: "skip" };
		}
	}

	async function handleFullFetch(url: string): Promise<ContentFreshnessResult> {
		try {
			const fetchResult = await deps.fetchHtmlWithHeaders(url);
			if (!fetchResult) return { action: "skip" };

			return handleChangedContent(url, {
				changed: true,
				html: fetchResult.html,
				etag: fetchResult.etag,
				lastModified: fetchResult.lastModified,
			});
		} catch (error) {
			deps.logError("Full fetch failed", error instanceof Error ? error : undefined);
			return { action: "skip" };
		}
	}

	async function handleChangedContent(
		url: string,
		result: ConditionalFetchResult & { changed: true },
	): Promise<ContentFreshnessResult> {
		const parsed = deps.parseHtml({ url, html: result.html });
		if (!parsed.ok) return { action: "skip" };

		await Promise.all([
			deps.updateArticleContent({
				url,
				metadata: {
					title: parsed.article.title,
					siteName: parsed.article.siteName,
					excerpt: parsed.article.excerpt,
					wordCount: parsed.article.wordCount,
					imageUrl: parsed.article.imageUrl,
				},
				content: fitContent(parsed.article.content),
				estimatedReadTime: calculateReadTime(parsed.article.wordCount),
				etag: result.etag,
				lastModified: result.lastModified,
				contentFetchedAt: deps.now().toISOString(),
			}),
			deps.clearArticleSummary(url),
		]);

		return { action: "refreshed", article: parsed };
	}

	return { refreshArticleIfStale };
}
