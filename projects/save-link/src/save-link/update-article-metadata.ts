/* c8 ignore start -- thin AWS SDK wrapper, tested via integration */
import {
	type DynamoDBDocumentClient,
	defineDynamoTable,
	dynamoField,
} from "@packages/hutch-storage-client";
import { z } from "zod";
import { ArticleResourceUniqueId } from "./article-resource-unique-id";

export type UpdateArticleMetadata = (params: {
	url: string;
	title: string;
	siteName: string;
	excerpt: string;
	wordCount: number;
	estimatedReadTime: number;
	imageUrl?: string;
}) => Promise<void>;

const ArticleRow = z.object({
	url: z.string(),
	title: dynamoField(z.string()),
	siteName: dynamoField(z.string()),
	excerpt: dynamoField(z.string()),
	wordCount: dynamoField(z.number()),
	estimatedReadTime: dynamoField(z.number()),
	imageUrl: dynamoField(z.string()),
});

export function initUpdateArticleMetadata(deps: {
	client: DynamoDBDocumentClient;
	tableName: string;
}): { updateArticleMetadata: UpdateArticleMetadata } {
	const table = defineDynamoTable({
		client: deps.client,
		tableName: deps.tableName,
		schema: ArticleRow,
	});

	const updateArticleMetadata: UpdateArticleMetadata = async (params) => {
		const articleResourceUniqueId = ArticleResourceUniqueId.parse(params.url);
		const setClauses = [
			"title = :t",
			"siteName = :s",
			"excerpt = :e",
			"wordCount = :w",
			"estimatedReadTime = :r",
		];
		const values: Record<string, unknown> = {
			":t": params.title,
			":s": params.siteName,
			":e": params.excerpt,
			":w": params.wordCount,
			":r": params.estimatedReadTime,
		};
		if (params.imageUrl) {
			setClauses.push("imageUrl = :img");
			values[":img"] = params.imageUrl;
		}
		await table.update({
			Key: { url: articleResourceUniqueId.value },
			UpdateExpression: `SET ${setClauses.join(", ")}`,
			ExpressionAttributeValues: values,
		});
	};

	return { updateArticleMetadata };
}
/* c8 ignore stop */
