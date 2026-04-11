/* c8 ignore start -- thin AWS SDK wrapper, tested via integration */
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ArticleResourceUniqueId } from "./article-resource-unique-id";
import type { UpdateContentLocation } from "./save-link-command-handler";

export function initUpdateContentLocation(deps: {
	client: DynamoDBDocumentClient;
	tableName: string;
}): { updateContentLocation: UpdateContentLocation } {
	const { client, tableName } = deps;

	const updateContentLocation: UpdateContentLocation = async (params) => {
		const articleResourceUniqueId = ArticleResourceUniqueId.parse(params.url);
		await client.send(
			new UpdateCommand({
				TableName: tableName,
				Key: { url: articleResourceUniqueId.value },
				UpdateExpression: "SET contentLocation = :cl REMOVE content",
				ExpressionAttributeValues: {
					":cl": params.contentLocation,
				},
			}),
		);
	};

	return { updateContentLocation };
}
/* c8 ignore stop */
