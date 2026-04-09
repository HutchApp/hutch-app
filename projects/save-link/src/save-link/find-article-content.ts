/* c8 ignore start -- thin AWS SDK wrapper, tested via integration */
import assert from 'node:assert'
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { ArticleUniqueId } from "./article-unique-id";

export type ArticleContentResult = { content: string; imageUrl?: string };
export type FindArticleContent = (url: string) => Promise<ArticleContentResult | undefined>;

const ArticleContentRow = z.object({
	content: z.string().optional(),
	imageUrl: z.string().optional(),
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
				Key: { url: ArticleUniqueId.parse(url).value },
				ProjectionExpression: "content, imageUrl",
			}),
		);
		assert(result.Item, 'result.Item must exist')
		const parsed = ArticleContentRow.parse(result.Item);
		if (!parsed.content) return undefined;
		return { content: parsed.content, imageUrl: parsed.imageUrl };
	};

	return { findArticleContent };
}
/* c8 ignore stop */
