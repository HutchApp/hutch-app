/* c8 ignore start -- thin AWS SDK wrapper, tested via integration */
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ArticleUniqueId } from "./article-unique-id";
import type { UpdateFetchTimestamp } from "./update-fetch-timestamp-handler";

export function initUpdateFetchTimestamp(deps: {
	client: DynamoDBDocumentClient;
	tableName: string;
}): { updateFetchTimestamp: UpdateFetchTimestamp } {
	const { client, tableName } = deps;

	const updateFetchTimestamp: UpdateFetchTimestamp = async (params) => {
		const articleUniqueId = ArticleUniqueId.parse(params.url);
		await client.send(
			new UpdateCommand({
				TableName: tableName,
				Key: { url: articleUniqueId.value },
				UpdateExpression: "SET contentFetchedAt = :cfa",
				ExpressionAttributeValues: {
					":cfa": params.contentFetchedAt,
				},
			}),
		);
	};

	return { updateFetchTimestamp };
}
/* c8 ignore stop */
