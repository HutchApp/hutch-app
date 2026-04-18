/* c8 ignore start -- thin AWS SDK wrapper, tested via integration */
import {
	type DynamoDBDocumentClient,
	defineDynamoTable,
	dynamoField,
} from "@packages/hutch-storage-client";
import { z } from "zod";
import { ArticleResourceUniqueId } from "./article-resource-unique-id";

export type UpdateThumbnailUrl = (params: { url: string; imageUrl: string }) => Promise<void>;

const ArticleRow = z.object({ url: z.string(), imageUrl: dynamoField(z.string()) });

export function initUpdateThumbnailUrl(deps: {
	client: DynamoDBDocumentClient;
	tableName: string;
}): { updateThumbnailUrl: UpdateThumbnailUrl } {
	const table = defineDynamoTable({
		client: deps.client,
		tableName: deps.tableName,
		schema: ArticleRow,
	});

	const updateThumbnailUrl: UpdateThumbnailUrl = async (params) => {
		const articleResourceUniqueId = ArticleResourceUniqueId.parse(params.url);
		await table.update({
			Key: { url: articleResourceUniqueId.value },
			UpdateExpression: "SET imageUrl = :iu",
			ExpressionAttributeValues: { ":iu": params.imageUrl },
		});
	};

	return { updateThumbnailUrl };
}
/* c8 ignore stop */
