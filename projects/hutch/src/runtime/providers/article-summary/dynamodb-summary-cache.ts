/* c8 ignore start -- thin AWS SDK wrapper, tested via integration */
import {
	type DynamoDBDocumentClient,
	defineDynamoTable,
	dynamoField,
} from "@packages/hutch-storage-client";
import { z } from "zod";
import { ArticleResourceUniqueId, stripTrackingParams } from "@packages/article-resource-unique-id";
import type { FindCachedSummary } from "./article-summary.types";

const ArticleSummaryRow = z.object({
	url: z.string(),
	summary: dynamoField(z.string()),
});

export function initDynamoDbSummaryCache(deps: {
	client: DynamoDBDocumentClient;
	tableName: string;
}): {
	findCachedSummary: FindCachedSummary;
} {
	const table = defineDynamoTable({
		client: deps.client,
		tableName: deps.tableName,
		schema: ArticleSummaryRow,
	});

	const findCachedSummary: FindCachedSummary = async (url) => {
		const articleResourceUniqueId = ArticleResourceUniqueId.parse(stripTrackingParams(url));
		const row = await table.get({ url: articleResourceUniqueId.value });
		return row?.summary ?? "";
	};

	return { findCachedSummary };
}
/* c8 ignore stop */
