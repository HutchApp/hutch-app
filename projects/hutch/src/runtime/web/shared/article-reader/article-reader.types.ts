import type {
	ArticleMetadata,
	Minutes,
} from "../../../domain/article/article.types";
import type {
	ArticleCrawl,
	FindArticleCrawlStatus,
	MarkCrawlPending,
} from "../../../providers/article-crawl/article-crawl.types";
import type {
	FindGeneratedSummary,
	GeneratedSummary,
	MarkSummaryPending,
} from "../../../providers/article-summary/article-summary.types";
import type { ReadArticleContent } from "../../../providers/article-store/read-article-content";
import type { ProgressTick } from "../article-body/progress-mapping";

export interface ArticleReaderDeps {
	findArticleCrawlStatus: FindArticleCrawlStatus;
	markCrawlPending: MarkCrawlPending;
	findGeneratedSummary: FindGeneratedSummary;
	markSummaryPending: MarkSummaryPending;
	readArticleContent: ReadArticleContent;
	now: () => Date;
}

export interface ArticleSnapshot {
	url: string;
	metadata: ArticleMetadata;
	estimatedReadTime: Minutes;
}

export interface PollUrlBuilder {
	summary: (pollCount: number) => string;
	reader: (pollCount: number) => string;
}

export interface ReaderState {
	content: string | undefined;
	crawl: ArticleCrawl | undefined;
	summary: GeneratedSummary | undefined;
	readerPollUrl: string | undefined;
	summaryPollUrl: string | undefined;
	/** Present when crawl status is `pending`. Drives the reader-slot progress bar. */
	crawlProgress: ProgressTick | undefined;
	/**
	 * Present when summary status is `pending` AND the crawl has not failed.
	 * On crawl-failed the summary slot collapses so no bar is rendered.
	 */
	summaryProgress: ProgressTick | undefined;
}

export interface ResolveReaderStateParams {
	article: ArticleSnapshot;
	pollUrlBuilder: PollUrlBuilder;
}

export interface HandlePollParams {
	articleUrl: string;
	pollCount: number;
	pollUrlBuilder: PollUrlBuilder;
}
