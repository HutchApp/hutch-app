/* c8 ignore start -- thin AWS SDK wrapper, tested via integration */
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ArticleUniqueId } from "./article-unique-id";
import type { UpdateContentLocation } from "./save-link-command-handler";

export function initUpdateContentLocation(deps: {
	client: DynamoDBDocumentClient;
	tableName: string;
}): { updateContentLocation: UpdateContentLocation } {
	const { client, tableName } = deps;

	const updateContentLocation: UpdateContentLocation = async (params) => {
		const articleUniqueId = ArticleUniqueId.parse(params.url);
		await client.send(
			new UpdateCommand({
				TableName: tableName,
				Key: { url: articleUniqueId.value },
				UpdateExpression: "SET contentLocation = :cl",
				ExpressionAttributeValues: {
					":cl": params.contentLocation,
				},
			}),
		);
	};

	return { updateContentLocation };
}
/* c8 ignore stop */
