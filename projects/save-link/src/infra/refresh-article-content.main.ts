import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { consoleLogger } from "@packages/hutch-logger";
import { requireEnv } from "../require-env";
import { initRefreshArticleContent } from "../save-link/refresh-article-content";
import { initRefreshArticleContentHandler } from "../save-link/refresh-article-content-handler";

const articlesTable = requireEnv("DYNAMODB_ARTICLES_TABLE");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const { refreshArticleContent } = initRefreshArticleContent({
	client,
	tableName: articlesTable,
});

export const handler = initRefreshArticleContentHandler({
	refreshArticleContent,
	logger: consoleLogger,
});
