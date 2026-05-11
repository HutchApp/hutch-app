import { ArticleResourceUniqueId } from "@packages/article-resource-unique-id";
import {
	CrawlStatusSchema,
	SummaryStatusSchema,
} from "@packages/article-state-types";
import type {
	Article,
	ArticleStore,
	CrawlState,
	SummaryState,
} from "@packages/domain/article";
import {
	AggregateConcurrencyError,
	type Minutes,
} from "@packages/domain/article";
import type { HutchLogger } from "@packages/hutch-logger";
import {
	ConditionalCheckFailedException,
	type DynamoDBDocumentClient,
	defineDynamoTable,
	dynamoField,
} from "@packages/hutch-storage-client";
import { z } from "zod";

const ArticleAggregateRow = z.object({
	url: z.string(),
	version: dynamoField(z.number().int().nonnegative()),
	crawlStatus: dynamoField(CrawlStatusSchema),
	crawlFailureReason: dynamoField(z.string()),
	crawlUnsupportedReason: dynamoField(z.string()),
	crawlFailedAt: dynamoField(z.string()),
	crawlStage: dynamoField(
		z.enum([
			"crawl-fetching",
			"crawl-fetched",
			"crawl-parsed",
			"crawl-metadata-written",
			"crawl-content-uploaded",
		]),
	),
	summaryStatus: dynamoField(SummaryStatusSchema),
	summary: dynamoField(z.string()),
	summaryExcerpt: dynamoField(z.string()),
	summaryInputTokens: dynamoField(z.number().int().nonnegative()),
	summaryOutputTokens: dynamoField(z.number().int().nonnegative()),
	summaryFailureReason: dynamoField(z.string()),
	summarySkippedReason: dynamoField(z.string()),
	summaryStage: dynamoField(z.enum(["summary-started", "summary-generating"])),
	title: dynamoField(z.string()),
	siteName: dynamoField(z.string()),
	excerpt: dynamoField(z.string()),
	wordCount: dynamoField(z.number()),
	estimatedReadTime: dynamoField(z.number()),
	imageUrl: dynamoField(z.string()),
	contentFetchedAt: dynamoField(z.string()),
	etag: dynamoField(z.string()),
	lastModified: dynamoField(z.string()),
});

type Row = z.infer<typeof ArticleAggregateRow>;

function rowToCrawl(row: Row): CrawlState {
	if (row.crawlStatus === "failed") {
		return {
			status: "failed",
			reason: row.crawlFailureReason ?? "unknown",
			failedAt: row.crawlFailedAt ?? "",
		};
	}
	if (row.crawlStatus === "unsupported") {
		return {
			status: "unsupported",
			reason: row.crawlUnsupportedReason ?? "unknown",
			failedAt: row.crawlFailedAt ?? "",
		};
	}
	if (row.crawlStatus === "ready") return { status: "ready" };
	// pending and the legacy-stub case (status absent) both project as pending.
	// The legacy-stub branch lets the aggregate own all rows including the ones
	// older than the state machine — the storage adapter's job is to make every
	// row look like a valid aggregate, not to filter rows the rest of the
	// system can't handle.
	return row.crawlStage
		? { status: "pending", stage: row.crawlStage }
		: { status: "pending" };
}

function rowToSummary(row: Row): SummaryState {
	if (row.summaryStatus === "failed") {
		return { status: "failed", reason: row.summaryFailureReason ?? "unknown" };
	}
	if (row.summaryStatus === "skipped") {
		return row.summarySkippedReason
			? { status: "skipped", reason: row.summarySkippedReason }
			: { status: "skipped" };
	}
	if (row.summaryStatus === "ready") {
		// Legacy fallback: rows can carry a `summary` string with no
		// `summaryInputTokens` / `summaryOutputTokens` (pre-state-machine
		// backfills, see dynamodb-generated-summary.ts:78). The aggregate
		// requires both counts; coerce missing values to 0 rather than
		// rejecting the row — Phase 4's legacy-stub migration (out of scope
		// for this PR) is the place to backfill real values.
		const summary = row.summary ?? "";
		const ready: SummaryState = {
			status: "ready",
			summary,
			inputTokens: row.summaryInputTokens ?? 0,
			outputTokens: row.summaryOutputTokens ?? 0,
		};
		if (row.summaryExcerpt) ready.excerpt = row.summaryExcerpt;
		return ready;
	}
	return row.summaryStage
		? { status: "pending", stage: row.summaryStage }
		: { status: "pending" };
}

function rowToArticle(row: Row): Article {
	return {
		url: row.url,
		// Pre-aggregate rows have no version attribute on disk and project to 0;
		// first aggregate save then writes version 1.
		version: row.version ?? 0,
		crawl: rowToCrawl(row),
		summary: rowToSummary(row),
		metadata: {
			title: row.title ?? "",
			siteName: row.siteName ?? "",
			excerpt: row.excerpt ?? "",
			wordCount: row.wordCount ?? 0,
			...(row.imageUrl ? { imageUrl: row.imageUrl } : {}),
		},
		estimatedReadTime: (row.estimatedReadTime ?? 0) as Minutes,
		...(row.contentFetchedAt ? { contentFetchedAt: row.contentFetchedAt } : {}),
		...(row.etag ? { etag: row.etag } : {}),
		...(row.lastModified ? { lastModified: row.lastModified } : {}),
	};
}

interface UpdatePlan {
	sets: string[];
	removes: string[];
	values: Record<string, unknown>;
}

function planCrawl(crawl: CrawlState, plan: UpdatePlan): void {
	plan.sets.push("crawlStatus = :crawlStatus");
	plan.values[":crawlStatus"] = crawl.status;
	if (crawl.status === "failed") {
		plan.sets.push("crawlFailureReason = :crawlFailureReason");
		plan.sets.push("crawlFailedAt = :crawlFailedAt");
		plan.values[":crawlFailureReason"] = crawl.reason;
		plan.values[":crawlFailedAt"] = crawl.failedAt;
		plan.removes.push("crawlUnsupportedReason");
		return;
	}
	if (crawl.status === "unsupported") {
		plan.sets.push("crawlUnsupportedReason = :crawlUnsupportedReason");
		plan.sets.push("crawlFailedAt = :crawlFailedAt");
		plan.values[":crawlUnsupportedReason"] = crawl.reason;
		plan.values[":crawlFailedAt"] = crawl.failedAt;
		plan.removes.push("crawlFailureReason");
		return;
	}
	// ready / pending: clear every failure-side attribute so a future reader
	// never sees a status=ready row with a lingering crawlFailureReason. The
	// aggregate's discriminated union makes this impossible to forget in
	// code — the adapter just mirrors it at the wire format.
	plan.removes.push("crawlFailureReason");
	plan.removes.push("crawlUnsupportedReason");
	plan.removes.push("crawlFailedAt");
}

function planSummary(summary: SummaryState, plan: UpdatePlan): void {
	plan.sets.push("summaryStatus = :summaryStatus");
	plan.values[":summaryStatus"] = summary.status;
	if (summary.status === "ready") {
		plan.sets.push("summary = :summary");
		plan.sets.push("summaryInputTokens = :summaryInputTokens");
		plan.sets.push("summaryOutputTokens = :summaryOutputTokens");
		plan.values[":summary"] = summary.summary;
		plan.values[":summaryInputTokens"] = summary.inputTokens;
		plan.values[":summaryOutputTokens"] = summary.outputTokens;
		if (summary.excerpt) {
			plan.sets.push("summaryExcerpt = :summaryExcerpt");
			plan.values[":summaryExcerpt"] = summary.excerpt;
		} else {
			plan.removes.push("summaryExcerpt");
		}
		plan.removes.push("summaryFailureReason");
		plan.removes.push("summarySkippedReason");
		return;
	}
	if (summary.status === "failed") {
		plan.sets.push("summaryFailureReason = :summaryFailureReason");
		plan.values[":summaryFailureReason"] = summary.reason;
		plan.removes.push("summary");
		plan.removes.push("summaryExcerpt");
		plan.removes.push("summaryInputTokens");
		plan.removes.push("summaryOutputTokens");
		plan.removes.push("summarySkippedReason");
		return;
	}
	if (summary.status === "skipped") {
		if (summary.reason) {
			plan.sets.push("summarySkippedReason = :summarySkippedReason");
			plan.values[":summarySkippedReason"] = summary.reason;
		} else {
			plan.removes.push("summarySkippedReason");
		}
		plan.removes.push("summary");
		plan.removes.push("summaryExcerpt");
		plan.removes.push("summaryInputTokens");
		plan.removes.push("summaryOutputTokens");
		plan.removes.push("summaryFailureReason");
		return;
	}
	// pending: clear every payload-side attribute so a status=ready snapshot
	// can never bleed into a status=pending row (the 2026-05-10 regression).
	plan.removes.push("summary");
	plan.removes.push("summaryExcerpt");
	plan.removes.push("summaryInputTokens");
	plan.removes.push("summaryOutputTokens");
	plan.removes.push("summaryFailureReason");
	plan.removes.push("summarySkippedReason");
}

function setRequired(
	plan: UpdatePlan,
	field: string,
	value: string | number,
): void {
	plan.sets.push(`${field} = :${field}`);
	plan.values[`:${field}`] = value;
}

function setOrRemoveOptional(
	plan: UpdatePlan,
	field: string,
	value: string | undefined,
): void {
	if (value) {
		setRequired(plan, field, value);
		return;
	}
	plan.removes.push(field);
}

function planMetadata(article: Article, plan: UpdatePlan): void {
	setRequired(plan, "title", article.metadata.title);
	setRequired(plan, "siteName", article.metadata.siteName);
	setRequired(plan, "excerpt", article.metadata.excerpt);
	setRequired(plan, "wordCount", article.metadata.wordCount);
	setRequired(plan, "estimatedReadTime", article.estimatedReadTime);
	setOrRemoveOptional(plan, "imageUrl", article.metadata.imageUrl);
}

function planFreshness(article: Article, plan: UpdatePlan): void {
	setOrRemoveOptional(plan, "contentFetchedAt", article.contentFetchedAt);
	/* c8 ignore next -- V8 block-coverage phantom on the optional-field argument expression; see bcoe/c8#319 and https://v8.dev/blog/javascript-code-coverage */
	setOrRemoveOptional(plan, "etag", article.etag);
	setOrRemoveOptional(plan, "lastModified", article.lastModified);
}

function buildUpdate(
	article: Article,
	nextVersion: number,
): {
	UpdateExpression: string;
	ExpressionAttributeValues: Record<string, unknown>;
} {
	const plan: UpdatePlan = {
		sets: ["version = :nextVersion"],
		removes: [],
		values: { ":nextVersion": nextVersion },
	};
	planCrawl(article.crawl, plan);
	planSummary(article.summary, plan);
	planMetadata(article, plan);
	planFreshness(article, plan);

	const setExpr = `SET ${plan.sets.join(", ")}`;
	const removeExpr =
		plan.removes.length > 0 ? ` REMOVE ${plan.removes.join(", ")}` : "";
	return {
		UpdateExpression: setExpr + removeExpr,
		ExpressionAttributeValues: plan.values,
	};
}

export interface DynamoDbArticleStoreDeps {
	client: DynamoDBDocumentClient;
	tableName: string;
	logger: HutchLogger;
}

export function initDynamoDbArticleStore(
	deps: DynamoDbArticleStoreDeps,
): ArticleStore {
	const table = defineDynamoTable({
		client: deps.client,
		tableName: deps.tableName,
		schema: ArticleAggregateRow,
	});

	return {
		load: async (url) => {
			const id = ArticleResourceUniqueId.parse(url);
			const row = await table.get({ url: id.value });
			if (!row) return undefined;
			return rowToArticle(row);
		},
		save: async ({ article, expectedVersion }) => {
			const id = ArticleResourceUniqueId.parse(article.url);
			const nextVersion = expectedVersion + 1;
			const update = buildUpdate(article, nextVersion);
			try {
				await table.update({
					Key: { url: id.value },
					UpdateExpression: update.UpdateExpression,
					ConditionExpression:
						expectedVersion === 0
							? "attribute_not_exists(version) OR version = :expectedVersion"
							: "version = :expectedVersion",
					ExpressionAttributeValues: {
						...update.ExpressionAttributeValues,
						":expectedVersion": expectedVersion,
					},
				});
			} catch (err) {
				if (err instanceof ConditionalCheckFailedException) {
					// Log so the operator can grep these in CloudWatch Logs Insights
					// for tuning the retry budget; a separate metric filter on the
					// log group can roll this up to a CloudWatch metric without
					// requiring an SDK dependency here.
					deps.logger.warn("[article-aggregate-store] concurrency conflict", {
						url: article.url,
						expectedVersion,
					});
					throw new AggregateConcurrencyError({
						url: article.url,
						expectedVersion,
					});
				}
				throw err;
			}
		},
	};
}
