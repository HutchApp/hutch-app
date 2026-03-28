import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { GetCommand } from "@aws-sdk/lib-dynamodb";

export type FindArticleContent = (url: string) => Promise<string | undefined>;

export function initFindArticleContent(deps: {
	client: DynamoDBDocumentClient;
	tableName: string;
}): { findArticleContent: FindArticleContent } {
	const { client, tableName } = deps;

	const findArticleContent: FindArticleContent = async (url) => {
		const result = await client.send(
			new GetCommand({
				TableName: tableName,
				Key: { url },
				ProjectionExpression: "content",
			}),
		);
		return result.Item?.content as string | undefined;
	};

	return { findArticleContent };
}
