import assert from "node:assert";
import {
	ConditionalCheckFailedException,
	type DynamoDBDocumentClient,
	defineDynamoTable,
	dynamoField,
} from "@packages/hutch-storage-client";
import { z } from "zod";
import { ArticleResourceUniqueId } from "@packages/article-resource-unique-id";
import type {
	ArticleCrawl,
	FindArticleCrawlStatus,
	MarkCrawlPending,
} from "./article-crawl.types";

const ArticleCrawlRow = z.object({
	url: z.string(),
	content: dynamoField(z.string()),
	crawlStatus: dynamoField(z.enum(["pending", "ready", "failed"])),
	crawlFailureReason: dynamoField(z.string()),
});

type ArticleCrawlRowShape = z.infer<typeof ArticleCrawlRow>;

function rowToArticleCrawl(
	row: ArticleCrawlRowShape | undefined,
): ArticleCrawl | undefined {
	if (!row) return undefined;
	if (row.crawlStatus === "failed") {
		assert(
			row.crawlFailureReason,
			"crawlStatus=failed row must carry a crawlFailureReason",
		);
		return { status: "failed", reason: row.crawlFailureReason };
	}
	if (row.crawlStatus === "pending") return { status: "pending" };
	if (row.crawlStatus === "ready") return { status: "ready" };
	// Legacy row (status attribute missing). Treat as ready iff content is
	// already present in the row (pre-S3 migration layout); otherwise pending.
	return row.content ? { status: "ready" } : { status: "pending" };
}

export function initDynamoDbArticleCrawl(deps: {
	client: DynamoDBDocumentClient;
	tableName: string;
}): {
	findArticleCrawlStatus: FindArticleCrawlStatus;
	markCrawlPending: MarkCrawlPending;
} {
	const table = defineDynamoTable({
		client: deps.client,
		tableName: deps.tableName,
		schema: ArticleCrawlRow,
	});

	const findArticleCrawlStatus: FindArticleCrawlStatus = async (url) => {
		const articleResourceUniqueId = ArticleResourceUniqueId.parse(url);
		const row = await table.get({ url: articleResourceUniqueId.value });
		return rowToArticleCrawl(row);
	};

	const markCrawlPending: MarkCrawlPending = async ({ url }) => {
		const articleResourceUniqueId = ArticleResourceUniqueId.parse(url);
		try {
			await table.update({
				Key: { url: articleResourceUniqueId.value },
				UpdateExpression: "SET crawlStatus = :pending",
				ConditionExpression:
					"attribute_not_exists(crawlStatus) OR crawlStatus <> :ready",
				ExpressionAttributeValues: {
					":pending": "pending",
					":ready": "ready",
				},
			});
		} catch (err) {
			if (!(err instanceof ConditionalCheckFailedException)) throw err;
		}
	};

	return { findArticleCrawlStatus, markCrawlPending };
}
