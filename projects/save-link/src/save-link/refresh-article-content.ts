/* c8 ignore start -- thin AWS SDK wrapper, tested via integration */
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ArticleResourceUniqueId } from "./article-resource-unique-id";
import type { RefreshArticleContent } from "./refresh-article-content-handler";

export function initRefreshArticleContent(deps: {
	client: DynamoDBDocumentClient;
	tableName: string;
}): { refreshArticleContent: RefreshArticleContent } {
	const { client, tableName } = deps;

	const refreshArticleContent: RefreshArticleContent = async (params) => {
		const articleResourceUniqueId = ArticleResourceUniqueId.parse(params.url);
		await client.send(
			new UpdateCommand({
				TableName: tableName,
				Key: { url: articleResourceUniqueId.value },
				UpdateExpression: "SET title = :title, siteName = :siteName, excerpt = :excerpt, wordCount = :wordCount, estimatedReadTime = :ert, contentFetchedAt = :cfa, etag = :etag, lastModified = :lm, imageUrl = :img REMOVE summary, summaryInputTokens, summaryOutputTokens",
				ExpressionAttributeValues: {
					":title": params.metadata.title,
					":siteName": params.metadata.siteName,
					":excerpt": params.metadata.excerpt,
					":wordCount": params.metadata.wordCount,
					":ert": params.estimatedReadTime,
					":cfa": params.contentFetchedAt,
					":etag": params.etag ?? null,
					":lm": params.lastModified ?? null,
					":img": params.metadata.imageUrl ?? null,
				},
			}),
		);
	};

	return { refreshArticleContent };
}
/* c8 ignore stop */
