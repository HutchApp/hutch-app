import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { LinkId } from "./link-id";

export type FindArticleContent = (url: string) => Promise<string | undefined>;

const ArticleContentRow = z.object({
	content: z.string().optional(),
});

export function initFindArticleContent(deps: {
	client: DynamoDBDocumentClient;
	tableName: string;
}): { findArticleContent: FindArticleContent } {
	const { client, tableName } = deps;

	const findArticleContent: FindArticleContent = async (url) => {
		const result = await client.send(
			new GetCommand({
				TableName: tableName,
				Key: { url: LinkId.from(url) },
				ProjectionExpression: "content",
			}),
		);
		if (!result.Item) return undefined;
		const parsed = ArticleContentRow.parse(result.Item);
		return parsed.content;
	};

	return { findArticleContent };
}
