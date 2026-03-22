import { z } from "zod";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { FindCachedSummary, SaveCachedSummary } from "./article-summary.types";

const SummaryCacheRow = z.object({
	url: z.string(),
	summary: z.string(),
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
		const result = await client.send(
			new GetCommand({ TableName: tableName, Key: { url } }),
		);
		if (!result.Item) return "";
		const row = SummaryCacheRow.parse(result.Item);
		return row.summary;
	};

	const saveCachedSummary: SaveCachedSummary = async (params) => {
		await client.send(
			new PutCommand({
				TableName: tableName,
				Item: {
					url: params.url,
					summary: params.summary,
					inputTokens: params.inputTokens,
					outputTokens: params.outputTokens,
				},
			}),
		);
	};

	return { findCachedSummary, saveCachedSummary };
}
