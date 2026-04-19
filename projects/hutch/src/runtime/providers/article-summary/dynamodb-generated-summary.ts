/* c8 ignore start -- thin AWS SDK wrapper, tested via integration */
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
	GeneratedSummary,
	FindGeneratedSummary,
	MarkSummaryPending,
} from "./article-summary.types";

const ArticleSummaryRow = z.object({
	url: z.string(),
	summary: dynamoField(z.string()),
	summaryStatus: dynamoField(z.enum(["pending", "ready", "failed", "skipped"])),
	summaryFailureReason: dynamoField(z.string()),
});

type ArticleSummaryRowShape = z.infer<typeof ArticleSummaryRow>;

function rowToGeneratedSummary(
	row: ArticleSummaryRowShape | undefined,
): GeneratedSummary | undefined {
	if (!row) return undefined;
	if (row.summaryStatus === "failed") {
		assert(row.summaryFailureReason, "summaryStatus=failed row must carry a summaryFailureReason");
		return { status: "failed", reason: row.summaryFailureReason };
	}
	if (row.summaryStatus === "skipped") return { status: "skipped" };
	if (row.summaryStatus === "pending") return { status: "pending" };
	return row.summary ? { status: "ready", summary: row.summary } : { status: "pending" };
}

export function initDynamoDbGeneratedSummary(deps: {
	client: DynamoDBDocumentClient;
	tableName: string;
}): {
	findGeneratedSummary: FindGeneratedSummary;
	markSummaryPending: MarkSummaryPending;
} {
	const table = defineDynamoTable({
		client: deps.client,
		tableName: deps.tableName,
		schema: ArticleSummaryRow,
	});

	const findGeneratedSummary: FindGeneratedSummary = async (url) => {
		const articleResourceUniqueId = ArticleResourceUniqueId.parse(url);
		const row = await table.get({ url: articleResourceUniqueId.value });
		return rowToGeneratedSummary(row);
	};

	const markSummaryPending: MarkSummaryPending = async ({ url }) => {
		const articleResourceUniqueId = ArticleResourceUniqueId.parse(url);
		try {
			await table.update({
				Key: { url: articleResourceUniqueId.value },
				UpdateExpression: "SET summaryStatus = :pending",
				ConditionExpression:
					"attribute_not_exists(summaryStatus) OR summaryStatus <> :ready",
				ExpressionAttributeValues: {
					":pending": "pending",
					":ready": "ready",
				},
			});
		} catch (err) {
			if (!(err instanceof ConditionalCheckFailedException)) throw err;
		}
	};

	return { findGeneratedSummary, markSummaryPending };
}
/* c8 ignore stop */
