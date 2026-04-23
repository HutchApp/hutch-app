import assert from "node:assert";
import {
	ConditionalCheckFailedException,
	type DynamoDBDocumentClient,
	defineDynamoTable,
	dynamoField,
} from "@packages/hutch-storage-client";
import { z } from "zod";
import { ArticleResourceUniqueId } from "../save-link/article-resource-unique-id";
import type {
	GeneratedSummary,
	FindGeneratedSummary,
	MarkSummaryFailed,
	MarkSummaryPending,
	MarkSummarySkipped,
	SaveGeneratedSummary,
} from "./article-summary.types";

const GeneratedSummaryRow = z.object({
	summary: dynamoField(z.string()),
	summaryStatus: dynamoField(z.enum(["pending", "ready", "failed", "skipped"])),
	summaryFailureReason: dynamoField(z.string()),
});

type GeneratedSummaryRowShape = z.infer<typeof GeneratedSummaryRow>;

function rowToGeneratedSummary(
	row: GeneratedSummaryRowShape | undefined,
): GeneratedSummary | undefined {
	if (!row) return undefined;
	if (row.summaryStatus === "failed") {
		assert(row.summaryFailureReason, "summaryStatus=failed row must carry a summaryFailureReason");
		return { status: "failed", reason: row.summaryFailureReason };
	}
	if (row.summaryStatus === "skipped") return { status: "skipped" };
	if (row.summaryStatus === "pending") return { status: "pending" };
	// Legacy row (summaryStatus absent). A backfilled `summary` column means the
	// row pre-dates the state machine but carried a pre-computed summary — expose
	// as ready. Otherwise return undefined so the caller can re-prime the pipeline
	// instead of treating the row as actively pending.
	return row.summary ? { status: "ready", summary: row.summary } : undefined;
}

async function swallowConditionalCheckFailure(action: () => Promise<void>): Promise<void> {
	try {
		await action();
	} catch (err) {
		/* c8 ignore next -- V8 block-coverage phantom on the catch-clause continuation branch, see bcoe/c8#319 */
		if (!(err instanceof ConditionalCheckFailedException)) throw err;
	}
}

export function initDynamoDbGeneratedSummary(deps: {
	client: DynamoDBDocumentClient;
	tableName: string;
}): {
	findGeneratedSummary: FindGeneratedSummary;
	saveGeneratedSummary: SaveGeneratedSummary;
	markSummaryPending: MarkSummaryPending;
	markSummaryFailed: MarkSummaryFailed;
	markSummarySkipped: MarkSummarySkipped;
} {
	const table = defineDynamoTable({
		client: deps.client,
		tableName: deps.tableName,
		schema: GeneratedSummaryRow,
	});

	const findGeneratedSummary: FindGeneratedSummary = async (url) => {
		const articleResourceUniqueId = ArticleResourceUniqueId.parse(url);
		const row = await table.get(
			{ url: articleResourceUniqueId.value },
			{ projection: ["summary", "summaryStatus", "summaryFailureReason"] },
		);
		return rowToGeneratedSummary(row);
	};

	const saveGeneratedSummary: SaveGeneratedSummary = async (params) => {
		const articleResourceUniqueId = ArticleResourceUniqueId.parse(params.url);
		await table.update({
			Key: { url: articleResourceUniqueId.value },
			UpdateExpression:
				"SET summary = :summary, summaryInputTokens = :inputTokens, summaryOutputTokens = :outputTokens, summaryStatus = :ready REMOVE summaryFailureReason",
			ExpressionAttributeValues: {
				":summary": params.summary,
				":inputTokens": params.inputTokens,
				":outputTokens": params.outputTokens,
				":ready": "ready",
			},
		});
	};

	const markSummaryPending: MarkSummaryPending = async ({ url }) => {
		const articleResourceUniqueId = ArticleResourceUniqueId.parse(url);
		// Idempotent: never clobbers an existing ready row (re-saves of the same URL).
		await swallowConditionalCheckFailure(() =>
			table.update({
				Key: { url: articleResourceUniqueId.value },
				UpdateExpression: "SET summaryStatus = :pending",
				ConditionExpression:
					"attribute_not_exists(summaryStatus) OR summaryStatus <> :ready",
				ExpressionAttributeValues: {
					":pending": "pending",
					":ready": "ready",
				},
			}),
		);
	};

	const markSummaryFailed: MarkSummaryFailed = async ({ url, reason }) => {
		const articleResourceUniqueId = ArticleResourceUniqueId.parse(url);
		// Allow pending → failed (normal) and failed → failed (redrive that fails
		// again, possibly with a new reason). Block ready/skipped from regressing.
		await swallowConditionalCheckFailure(() =>
			table.update({
				Key: { url: articleResourceUniqueId.value },
				UpdateExpression:
					"SET summaryStatus = :failed, summaryFailureReason = :reason",
				ConditionExpression:
					"attribute_not_exists(summaryStatus) OR summaryStatus = :pending OR summaryStatus = :failed",
				ExpressionAttributeValues: {
					":failed": "failed",
					":pending": "pending",
					":reason": reason,
				},
			}),
		);
	};

	const markSummarySkipped: MarkSummarySkipped = async ({ url }) => {
		const articleResourceUniqueId = ArticleResourceUniqueId.parse(url);
		await swallowConditionalCheckFailure(() =>
			table.update({
				Key: { url: articleResourceUniqueId.value },
				UpdateExpression: "SET summaryStatus = :skipped",
				ConditionExpression:
					"attribute_not_exists(summaryStatus) OR summaryStatus = :pending",
				ExpressionAttributeValues: {
					":skipped": "skipped",
					":pending": "pending",
				},
			}),
		);
	};

	return {
		findGeneratedSummary,
		saveGeneratedSummary,
		markSummaryPending,
		markSummaryFailed,
		markSummarySkipped,
	};
}
