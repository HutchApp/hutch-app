/* c8 ignore start -- thin AWS SDK wrapper, tested via integration */
import { z } from "zod";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { ArticleResourceUniqueId, stripTrackingParams } from "@packages/article-resource-unique-id";
import type { FindCachedSummary } from "./article-summary.types";

const ArticleSummaryRow = z.object({
	url: z.string(),
	summary: z.string().optional(),
});

export function initDynamoDbSummaryCache(deps: {
	client: DynamoDBDocumentClient;
	tableName: string;
}): {
	findCachedSummary: FindCachedSummary;
} {
	const { client, tableName } = deps;

	const findCachedSummary: FindCachedSummary = async (url) => {
		const articleResourceUniqueId = ArticleResourceUniqueId.parse(stripTrackingParams(url));
		const result = await client.send(
			new GetCommand({ TableName: tableName, Key: { url: articleResourceUniqueId.value } }),
		);
		if (!result.Item) return "";
		const row = ArticleSummaryRow.parse(result.Item);
		return row.summary ?? "";
	};

	return { findCachedSummary };
}
/* c8 ignore stop */
