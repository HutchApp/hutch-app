import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { FindCachedSummary, SaveCachedSummary } from "./article-summary.types";

export function initDynamoDbSummaryCache(deps: {
	client: DynamoDBDocumentClient;
	tableName: string;
}): {
	findCachedSummary: FindCachedSummary;
	saveCachedSummary: SaveCachedSummary;
} {
	const { client, tableName } = deps;

	const findCachedSummary: FindCachedSummary = async (url) => {
		const result = await client.send(
			new GetCommand({
				TableName: tableName,
				Key: { url },
				ProjectionExpression: "summary",
			}),
		);
		if (!result.Item) return "";
		return (result.Item.summary as string) ?? "";
	};

	const saveCachedSummary: SaveCachedSummary = async (params) => {
		await client.send(
			new UpdateCommand({
				TableName: tableName,
				Key: { url: params.url },
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
