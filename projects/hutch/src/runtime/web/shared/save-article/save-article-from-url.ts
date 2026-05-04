import { calculateReadTime } from "../../../domain/article/estimated-read-time";
import type { ContentFreshnessResult, RefreshArticleIfStale } from "../../../providers/article-freshness/check-content-freshness";
import type { MarkCrawlPending } from "../../../providers/article-crawl/article-crawl.types";
import type { MarkSummaryPending } from "../../../providers/article-summary/article-summary.types";
import type { SaveArticle, UpdateArticleStatus } from "../../../providers/article-store/article-store.types";
import type { PublishLinkSaved } from "../../../providers/events/publish-link-saved.types";
import type { PublishUpdateFetchTimestamp } from "../../../providers/events/publish-update-fetch-timestamp.types";
import type { UserId } from "../../../domain/user/user.types";
import type { SavedArticle } from "../../../domain/article/article.types";

export interface SaveArticleFromUrlDependencies {
	saveArticle: SaveArticle;
	updateArticleStatus: UpdateArticleStatus;
	markCrawlPending: MarkCrawlPending;
	markSummaryPending: MarkSummaryPending;
	publishUpdateFetchTimestamp: PublishUpdateFetchTimestamp;
	publishLinkSaved: PublishLinkSaved;
	refreshArticleIfStale: RefreshArticleIfStale;
}

async function markUnreadIfRead(
	updateArticleStatus: UpdateArticleStatus,
	saved: SavedArticle,
): Promise<SavedArticle> {
	if (saved.status === "read") {
		await updateArticleStatus(saved.id, saved.userId, "unread");
		return { ...saved, status: "unread", readAt: undefined };
	}
	return saved;
}

export async function saveArticleFromUrl(
	deps: SaveArticleFromUrlDependencies,
	params: { userId: UserId; url: string; freshness: ContentFreshnessResult },
): Promise<{ saved: SavedArticle }> {
	const { userId, url, freshness } = params;

	if (freshness.action === "new") {
		const hostname = new URL(url).hostname;
		const saved = await deps.saveArticle({
			userId,
			url,
			metadata: {
				title: `Article from ${hostname}`,
				siteName: hostname,
				excerpt: `Saved from ${hostname}.`,
				wordCount: 0,
			},
			estimatedReadTime: calculateReadTime(0),
		});
		await deps.markCrawlPending({ url });
		await deps.markSummaryPending({ url });
		await deps.publishUpdateFetchTimestamp({
			url,
			contentFetchedAt: new Date().toISOString(),
		});
		await deps.publishLinkSaved({ url, userId });
		return { saved: await markUnreadIfRead(deps.updateArticleStatus, saved) };
	}

	if (freshness.action === "reprime") {
		const saved = await deps.saveArticle({
			userId,
			url,
			metadata: { title: "", siteName: "", excerpt: "", wordCount: 0 },
			estimatedReadTime: calculateReadTime(0),
		});
		await deps.markCrawlPending({ url });
		await deps.markSummaryPending({ url });
		await deps.publishUpdateFetchTimestamp({
			url,
			contentFetchedAt: new Date().toISOString(),
		});
		await deps.publishLinkSaved({ url, userId });
		return { saved: await markUnreadIfRead(deps.updateArticleStatus, saved) };
	}

	const saved = await deps.saveArticle({
		userId,
		url,
		metadata: { title: "", siteName: "", excerpt: "", wordCount: 0 },
		estimatedReadTime: calculateReadTime(0),
	});

	if (freshness.action === "refreshed" && freshness.article.article.content) {
		await deps.markSummaryPending({ url });
		await deps.publishLinkSaved({ url, userId });
	}

	return { saved: await markUnreadIfRead(deps.updateArticleStatus, saved) };
}
