/* c8 ignore start -- thin AWS SDK wrapper, tested via integration */
import assert from 'node:assert'
import type { S3Client } from "@aws-sdk/client-s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { ArticleUniqueId } from "./article-unique-id";

export type ArticleContentResult = { content: string; imageUrl?: string };
export type FindArticleContent = (url: string) => Promise<ArticleContentResult | undefined>;

const ArticleContentRow = z.object({
	contentLocation: z.string().optional(),
	imageUrl: z.string().optional(),
});

function parseS3Uri(uri: string): { bucket: string; key: string } {
	const withoutProtocol = uri.slice("s3://".length);
	const slashIndex = withoutProtocol.indexOf("/");
	return {
		bucket: withoutProtocol.slice(0, slashIndex),
		key: withoutProtocol.slice(slashIndex + 1),
	};
}

export function initFindArticleContent(deps: {
	dynamoClient: DynamoDBDocumentClient;
	s3Client: S3Client;
	tableName: string;
}): { findArticleContent: FindArticleContent } {
	const { dynamoClient, s3Client, tableName } = deps;

	const findArticleContent: FindArticleContent = async (url) => {
		const result = await dynamoClient.send(
			new GetCommand({
				TableName: tableName,
				Key: { url: ArticleUniqueId.parse(url).value },
				ProjectionExpression: "contentLocation, imageUrl",
			}),
		);
		assert(result.Item, 'result.Item must exist')
		const parsed = ArticleContentRow.parse(result.Item);
		if (!parsed.contentLocation) return undefined;

		const { bucket, key } = parseS3Uri(parsed.contentLocation);
		const s3Result = await s3Client.send(
			new GetObjectCommand({ Bucket: bucket, Key: key }),
		);
		assert(s3Result.Body, "S3 GetObject response must have a Body");
		const content = await s3Result.Body.transformToString("utf-8");

		return { content, imageUrl: parsed.imageUrl };
	};

	return { findArticleContent };
}
/* c8 ignore stop */
