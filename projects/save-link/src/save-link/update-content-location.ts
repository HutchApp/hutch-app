/* c8 ignore start -- thin AWS SDK wrapper, tested via integration */
import {
	type DynamoDBDocumentClient,
	defineDynamoTable,
	dynamoField,
} from "@packages/hutch-storage-client";
import { z } from "zod";
import { ArticleResourceUniqueId } from "./article-resource-unique-id";
import type { UpdateContentLocation } from "./save-link-command-handler";

const ArticleRow = z.object({
	url: z.string(),
	contentLocation: dynamoField(z.string()),
});

export function initUpdateContentLocation(deps: {
	client: DynamoDBDocumentClient;
	tableName: string;
}): { updateContentLocation: UpdateContentLocation } {
	const table = defineDynamoTable({
		client: deps.client,
		tableName: deps.tableName,
		schema: ArticleRow,
	});

	const updateContentLocation: UpdateContentLocation = async (params) => {
		const articleResourceUniqueId = ArticleResourceUniqueId.parse(params.url);
		await table.update({
			Key: { url: articleResourceUniqueId.value },
			UpdateExpression: "SET contentLocation = :cl REMOVE content",
			ExpressionAttributeValues: { ":cl": params.contentLocation },
		});
	};

	return { updateContentLocation };
}
/* c8 ignore stop */
