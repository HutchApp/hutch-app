import {
	type DynamoDBDocumentClient,
	defineDynamoTable,
	dynamoField,
} from "@packages/hutch-storage-client";
import { z } from "zod";
import { ArticleResourceUniqueId, stripTrackingParams } from "../save-link/article-resource-unique-id";
import type { FindCachedSummary, SaveCachedSummary } from "./article-summary.types";

const SummaryCacheRow = z.object({
	summary: dynamoField(z.string()),
});

export function initDynamoDbSummaryCache(deps: {
	client: DynamoDBDocumentClient;
	tableName: string;
}): {
	findCachedSummary: FindCachedSummary;
	saveCachedSummary: SaveCachedSummary;
} {
	const table = defineDynamoTable({
		client: deps.client,
		tableName: deps.tableName,
		schema: SummaryCacheRow,
	});

	const findCachedSummary: FindCachedSummary = async (url) => {
		const articleResourceUniqueId = ArticleResourceUniqueId.parse(stripTrackingParams(url));
		const row = await table.get(
			{ url: articleResourceUniqueId.value },
			{ projection: ["summary"] },
		);
		return row?.summary ?? "";
	};

	const saveCachedSummary: SaveCachedSummary = async (params) => {
		const articleResourceUniqueId = ArticleResourceUniqueId.parse(stripTrackingParams(params.url));
		await table.update({
			Key: { url: articleResourceUniqueId.value },
			UpdateExpression:
				"SET summary = :summary, summaryInputTokens = :inputTokens, summaryOutputTokens = :outputTokens",
			ExpressionAttributeValues: {
				":summary": params.summary,
				":inputTokens": params.inputTokens,
				":outputTokens": params.outputTokens,
			},
		});
	};

	return { findCachedSummary, saveCachedSummary };
}
