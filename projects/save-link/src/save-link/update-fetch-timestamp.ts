/* c8 ignore start -- thin AWS SDK wrapper, tested via integration */
import {
	type DynamoDBDocumentClient,
	defineDynamoTable,
	dynamoField,
} from "@packages/hutch-storage-client";
import { z } from "zod";
import { ArticleResourceUniqueId } from "./article-resource-unique-id";
import type { UpdateFetchTimestamp } from "./update-fetch-timestamp-handler";

const ArticleRow = z.object({
	url: z.string(),
	contentFetchedAt: dynamoField(z.string()),
});

export function initUpdateFetchTimestamp(deps: {
	client: DynamoDBDocumentClient;
	tableName: string;
}): { updateFetchTimestamp: UpdateFetchTimestamp } {
	const table = defineDynamoTable({
		client: deps.client,
		tableName: deps.tableName,
		schema: ArticleRow,
	});

	const updateFetchTimestamp: UpdateFetchTimestamp = async (params) => {
		const articleResourceUniqueId = ArticleResourceUniqueId.parse(params.url);
		await table.update({
			Key: { url: articleResourceUniqueId.value },
			UpdateExpression: "SET contentFetchedAt = :cfa",
			ExpressionAttributeValues: { ":cfa": params.contentFetchedAt },
		});
	};

	return { updateFetchTimestamp };
}
/* c8 ignore stop */
