/* c8 ignore start -- thin AWS SDK wrapper, tested via integration */
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ArticleUniqueId } from "./article-unique-id";

export type UpdateThumbnailUrl = (params: { url: string; imageUrl: string }) => Promise<void>;

export function initUpdateThumbnailUrl(deps: {
	client: DynamoDBDocumentClient;
	tableName: string;
}): { updateThumbnailUrl: UpdateThumbnailUrl } {
	const { client, tableName } = deps;

	const updateThumbnailUrl: UpdateThumbnailUrl = async (params) => {
		const articleUniqueId = ArticleUniqueId.parse(params.url);
		await client.send(
			new UpdateCommand({
				TableName: tableName,
				Key: { url: articleUniqueId.value },
				UpdateExpression: "SET imageUrl = :iu",
				ExpressionAttributeValues: {
					":iu": params.imageUrl,
				},
			}),
		);
	};

	return { updateThumbnailUrl };
}
/* c8 ignore stop */
