import { ArticleResourceUniqueId } from "@packages/article-resource-unique-id";
import type { CrawlStage } from "../../web/shared/article-body/progress-mapping";
import type {
	ArticleCrawl,
	FindArticleCrawlStatus,
	ForceMarkCrawlPending,
	MarkCrawlPending,
} from "./article-crawl.types";

export type InMemoryMarkCrawlReady = (params: { url: string }) => Promise<void>;
export type InMemoryMarkCrawlFailed = (params: {
	url: string;
	reason: string;
}) => Promise<void>;
export type InMemoryMarkCrawlStage = (params: {
	url: string;
	stage: CrawlStage;
}) => Promise<void>;

export function initInMemoryArticleCrawl(): {
	findArticleCrawlStatus: FindArticleCrawlStatus;
	markCrawlPending: MarkCrawlPending;
	forceMarkCrawlPending: ForceMarkCrawlPending;
	markCrawlReady: InMemoryMarkCrawlReady;
	markCrawlFailed: InMemoryMarkCrawlFailed;
	markCrawlStage: InMemoryMarkCrawlStage;
} {
	const states = new Map<string, ArticleCrawl>();

	const findArticleCrawlStatus: FindArticleCrawlStatus = async (url) => {
		const id = ArticleResourceUniqueId.parse(url);
		return states.get(id.value);
	};

	const markCrawlPending: MarkCrawlPending = async ({ url }) => {
		const id = ArticleResourceUniqueId.parse(url);
		const current = states.get(id.value);
		if (current?.status === "ready") return;
		// Preserve any previously recorded stage on re-prime — the legacy-stub
		// healing path calls markCrawlPending after the worker may have already
		// written a stage. Mirroring DDB behaviour where the markCrawlPending
		// UpdateExpression only writes crawlStatus and leaves crawlStage
		// untouched.
		const existingStage =
			current?.status === "pending" ? current.stage : undefined;
		states.set(
			id.value,
			existingStage ? { status: "pending", stage: existingStage } : { status: "pending" },
		);
	};

	const forceMarkCrawlPending: ForceMarkCrawlPending = async ({ url }) => {
		const id = ArticleResourceUniqueId.parse(url);
		states.set(id.value, { status: "pending" });
	};

	const markCrawlReady: InMemoryMarkCrawlReady = async ({ url }) => {
		const id = ArticleResourceUniqueId.parse(url);
		states.set(id.value, { status: "ready" });
	};

	const markCrawlFailed: InMemoryMarkCrawlFailed = async ({ url, reason }) => {
		const id = ArticleResourceUniqueId.parse(url);
		const current = states.get(id.value);
		if (current?.status === "ready") return;
		states.set(id.value, { status: "failed", reason });
	};

	const markCrawlStage: InMemoryMarkCrawlStage = async ({ url, stage }) => {
		const id = ArticleResourceUniqueId.parse(url);
		const current = states.get(id.value);
		// Stage is only meaningful while pending. If the row is already ready or
		// failed, ignore — the worker may emit a final "crawl-ready" stage just
		// before flipping crawlStatus to ready, but in tests where ready is set
		// first we never want to regress to pending.
		if (current?.status === "ready" || current?.status === "failed") return;
		states.set(id.value, { status: "pending", stage });
	};

	return {
		findArticleCrawlStatus,
		markCrawlPending,
		forceMarkCrawlPending,
		markCrawlReady,
		markCrawlFailed,
		markCrawlStage,
	};
}
