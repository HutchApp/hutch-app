/* c8 ignore start -- thin AWS SDK wrapper, tested via integration */
import { z } from "zod";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { normalizeArticleUrl } from "../../domain/article/normalize-article-url";
import type { FindCachedSummary, SaveCachedSummary } from "./article-summary.types";

const ArticleSummaryRow = z.object({
	url: z.string(),
	summary: z.string().optional(),
});

export function initDynamoDbSummaryCache(deps: {
	client: DynamoDBDocumentClient;
	tableName: string;
}): {
	findCachedSummary: FindCachedSummary;
	saveCachedSummary: SaveCachedSummary;
} {
	const { client, tableName } = deps;

	const findCachedSummary: FindCachedSummary = async (url) => {
		const normalizedUrl = normalizeArticleUrl(url);
		const result = await client.send(
			new GetCommand({ TableName: tableName, Key: { url: normalizedUrl } }),
		);
		if (!result.Item) return "";
		const row = ArticleSummaryRow.parse(result.Item);
		return row.summary ?? "";
	};

	const saveCachedSummary: SaveCachedSummary = async (params) => {
		const normalizedUrl = normalizeArticleUrl(params.url);
		await client.send(
			new UpdateCommand({
				TableName: tableName,
				Key: { url: normalizedUrl },
				UpdateExpression: "SET summary = :summary, summaryInputTokens = :inputTokens, summaryOutputTokens = :outputTokens",
				ExpressionAttributeValues: {
					":summary": params.summary,
					":inputTokens": params.inputTokens,
					":outputTokens": params.outputTokens,
				},
			}),
		);
	};

	return { findCachedSummary, saveCachedSummary };
}
/* c8 ignore stop */
