import { z } from "zod";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ArticleResourceUniqueId } from "../save-link/article-resource-unique-id";
import type { FindCachedSummary, SaveCachedSummary } from "./article-summary.types";

const SummaryCacheRow = z.object({
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
		const articleResourceUniqueId = ArticleResourceUniqueId.parse(url);
		const result = await client.send(
			new GetCommand({
				TableName: tableName,
				Key: { url: articleResourceUniqueId.value },
				ProjectionExpression: "summary",
			}),
		);
		if (!result.Item) return "";
		const row = SummaryCacheRow.parse(result.Item);
		return row.summary ?? "";
	};

	const saveCachedSummary: SaveCachedSummary = async (params) => {
		const articleResourceUniqueId = ArticleResourceUniqueId.parse(params.url);
		await client.send(
			new UpdateCommand({
				TableName: tableName,
				Key: { url: articleResourceUniqueId.value },
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
