/* c8 ignore start -- thin AWS SDK wrapper, tested via integration */
import { z } from "zod";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
	BatchGetCommand,
	PutCommand,
	GetCommand,
	QueryCommand,
	DeleteCommand,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { SavedArticle } from "../../domain/article/article.types";
import { MinutesSchema, ArticleStatusSchema } from "../../domain/article/article.schema";
import { ArticleResourceUniqueId } from "@packages/article-resource-unique-id";
import { ReaderArticleHashId, ReaderArticleHashIdSchema } from "../../domain/article/reader-article-hash-id";
import { UserIdSchema } from "../../domain/user/user.schema";
import type { UserId } from "../../domain/user/user.types";
import type {
	DeleteArticle,
	FindArticleById,
	FindArticleFreshness,
	FindArticlesByUser,
	SaveArticle,
	UpdateArticleStatus,
} from "./article-store.types";
import type { ContentProvider } from "./read-article-content";

const ArticleContentRow = z.object({
	content: z.string().optional(),
});

/** 1. DynamoDB stores missing attributes as null, not undefined. .nullish() accepts both so Zod doesn't throw on null values left by previous writes (e.g. articles saved without lastModified). */
const ArticleFreshnessRow = z.object({
	etag: z.string().nullish(), /* 1 */
	lastModified: z.string().nullish(), /* 1 */
	contentFetchedAt: z.string().nullish(), /* 1 */
});

/** `routeId` column holds the `ReaderArticleHashId.value` (32-char hex). The Zod schema rehydrates it into a `ReaderArticleHashId` instance on read. */
const ArticleRow = z.object({
	url: z.string(),
	routeId: ReaderArticleHashIdSchema,
	originalUrl: z.string(),
	title: z.string(),
	siteName: z.string(),
	excerpt: z.string(),
	wordCount: z.number(),
	imageUrl: z.string().nullish(), /* 1 */
	content: z.string().optional(),

	estimatedReadTime: MinutesSchema,
});

const UserArticleRow = z.object({
	userId: UserIdSchema,
	url: z.string(),
	status: ArticleStatusSchema,
	savedAt: z.string(),
	readAt: z.string().optional(),
});

function toSavedArticle(
	article: z.infer<typeof ArticleRow>,
	userArticle: z.infer<typeof UserArticleRow>,
): SavedArticle {
	return {
		id: article.routeId,
		userId: userArticle.userId,
		url: article.originalUrl,
		metadata: {
			title: article.title,
			siteName: article.siteName,
			excerpt: article.excerpt,
			wordCount: article.wordCount,
			imageUrl: article.imageUrl ?? undefined,
		},
		content: article.content,

		estimatedReadTime: article.estimatedReadTime,
		status: userArticle.status,
		savedAt: new Date(userArticle.savedAt),
		readAt: userArticle.readAt ? new Date(userArticle.readAt) : undefined,
	};
}

export function initDynamoDbArticleStore(deps: {
	client: DynamoDBDocumentClient;
	tableName: string;
	userArticlesTableName: string;
}): {
	saveArticle: SaveArticle;
	findArticleById: FindArticleById;
	findArticlesByUser: FindArticlesByUser;
	deleteArticle: DeleteArticle;
	updateArticleStatus: UpdateArticleStatus;
	findArticleFreshness: FindArticleFreshness;
	readContent: ContentProvider;
} {
	const { client, tableName, userArticlesTableName } = deps;

	async function findArticleByRouteId(routeId: ReaderArticleHashId): Promise<z.infer<typeof ArticleRow> | null> {
		const result = await client.send(
			new QueryCommand({
				TableName: tableName,
				IndexName: "routeId-index",
				KeyConditionExpression: "routeId = :routeId",
				ExpressionAttributeValues: { ":routeId": routeId.value },
				Limit: 1,
			}),
		);
		const item = result.Items?.[0];
		if (!item) return null;
		return ArticleRow.parse(item);
	}

	async function findUserArticle(userId: UserId, url: string): Promise<z.infer<typeof UserArticleRow> | null> {
		const result = await client.send(
			new GetCommand({
				TableName: userArticlesTableName,
				Key: { userId, url },
			}),
		);
		if (!result.Item) return null;
		return UserArticleRow.parse(result.Item);
	}

	const saveArticle: SaveArticle = async (params) => {
		const articleResourceUniqueId = ArticleResourceUniqueId.parse(params.url);
		const routeId = ReaderArticleHashId.from(params.url);
		const now = new Date();

		const ignoreDuplicate = (error: unknown) => {
			if (error instanceof Error && error.name === "ConditionalCheckFailedException") return;
			throw error;
		};

		await Promise.all([
			client.send(
				new PutCommand({
					TableName: tableName,
					Item: {
						url: articleResourceUniqueId.value,
						routeId: routeId.value,
						originalUrl: params.url,
						title: params.metadata.title,
						siteName: params.metadata.siteName,
						excerpt: params.metadata.excerpt,
						wordCount: params.metadata.wordCount,
						imageUrl: params.metadata.imageUrl,
						estimatedReadTime: params.estimatedReadTime,
					},
					ConditionExpression: "attribute_not_exists(#url)",
					ExpressionAttributeNames: { "#url": "url" },
				}),
			).catch(ignoreDuplicate),
			client.send(
				new PutCommand({
					TableName: userArticlesTableName,
					Item: {
						userId: params.userId,
						url: articleResourceUniqueId.value,
						status: "unread",
						savedAt: now.toISOString(),
					},
					ConditionExpression: "attribute_not_exists(userId)",
				}),
			).catch(ignoreDuplicate),
		]);

		const [articleResult, uaResult] = await Promise.all([
			client.send(
				new GetCommand({ TableName: tableName, Key: { url: articleResourceUniqueId.value } }),
			),
			client.send(
				new GetCommand({
					TableName: userArticlesTableName,
					Key: { userId: params.userId, url: articleResourceUniqueId.value },
				}),
			),
		]);
		const article = ArticleRow.parse(articleResult.Item);
		const userArticle = UserArticleRow.parse(uaResult.Item);

		return toSavedArticle(article, userArticle);
	};

	const findArticleById: FindArticleById = async (routeId, userId) => {
		const article = await findArticleByRouteId(routeId);
		if (!article) return null;

		const userArticle = await findUserArticle(userId, article.url);
		if (!userArticle) return null;

		return toSavedArticle(article, userArticle);
	};

	const findArticlesByUser: FindArticlesByUser = async (query) => {
		const page = query.page ?? 1;
		const pageSize = query.pageSize ?? 20;
		const order = query.order ?? "desc";

		const expressionValues: Record<string, unknown> = {
			":userId": query.userId,
		};
		let filterExpression: string | undefined;
		let expressionAttributeNames: Record<string, string> | undefined;

		if (query.status) {
			filterExpression = "#status = :status";
			expressionValues[":status"] = query.status;
			expressionAttributeNames = { "#status": "status" };
		}

		let total = 0;
		let countStartKey: Record<string, unknown> | undefined;
		do {
			const countResult = await client.send(
				new QueryCommand({
					TableName: userArticlesTableName,
					IndexName: "userId-savedAt-index",
					KeyConditionExpression: "userId = :userId",
					FilterExpression: filterExpression,
					ExpressionAttributeValues: expressionValues,
					ExpressionAttributeNames: expressionAttributeNames,
					Select: "COUNT",
					ExclusiveStartKey: countStartKey,
				}),
			);
			total += countResult.Count ?? 0;
			countStartKey = countResult.LastEvaluatedKey as
				| Record<string, unknown>
				| undefined;
		} while (countStartKey);

		const itemsToSkip = (page - 1) * pageSize;
		const userArts: z.infer<typeof UserArticleRow>[] = [];
		let exclusiveStartKey: Record<string, unknown> | undefined;
		let skippedCount = 0;

		do {
			const result = await client.send(
				new QueryCommand({
					TableName: userArticlesTableName,
					IndexName: "userId-savedAt-index",
					KeyConditionExpression: "userId = :userId",
					FilterExpression: filterExpression,
					ExpressionAttributeValues: expressionValues,
					ExpressionAttributeNames: expressionAttributeNames,
					ScanIndexForward: order === "asc",
					Limit: pageSize,
					ExclusiveStartKey: exclusiveStartKey,
				}),
			);

			const items = result.Items ?? [];

			for (const item of items) {
				if (skippedCount < itemsToSkip) {
					skippedCount++;
				} else if (userArts.length < pageSize) {
					userArts.push(UserArticleRow.parse(item));
				}
			}

			exclusiveStartKey = result.LastEvaluatedKey as
				| Record<string, unknown>
				| undefined;

			if (userArts.length >= pageSize && !exclusiveStartKey) {
				break;
			}
		} while (
			exclusiveStartKey &&
			(skippedCount < itemsToSkip || userArts.length < pageSize)
		);

		if (userArts.length === 0) {
			return { articles: [], total, page, pageSize };
		}

		const urls = userArts.map((ua) => ({ url: ua.url }));
		const batchResult = await client.send(
			new BatchGetCommand({
				RequestItems: {
					[tableName]: { Keys: urls },
				},
			}),
		);

		const articlesByUrl = new Map<string, z.infer<typeof ArticleRow>>();
		for (const item of batchResult.Responses?.[tableName] ?? []) {
			const article = ArticleRow.parse(item);
			articlesByUrl.set(article.url, article);
		}

		const articles: SavedArticle[] = [];
		for (const ua of userArts) {
			const article = articlesByUrl.get(ua.url);
			if (article) {
				articles.push(toSavedArticle(article, ua));
			}
		}

		return { articles, total, page, pageSize };
	};

	const deleteArticle: DeleteArticle = async (routeId, userId) => {
		const article = await findArticleByRouteId(routeId);
		if (!article) return false;

		const ua = await findUserArticle(userId, article.url);
		if (!ua) return false;

		await client.send(
			new DeleteCommand({
				TableName: userArticlesTableName,
				Key: { userId, url: article.url },
			}),
		);
		return true;
	};

	const updateArticleStatus: UpdateArticleStatus = async (routeId, userId, status) => {
		const article = await findArticleByRouteId(routeId);
		if (!article) return false;

		const ua = await findUserArticle(userId, article.url);
		if (!ua) return false;

		if (status === "read") {
			await client.send(
				new UpdateCommand({
					TableName: userArticlesTableName,
					Key: { userId, url: article.url },
					UpdateExpression: "SET #status = :status, readAt = :readAt",
					ExpressionAttributeNames: { "#status": "status" },
					ExpressionAttributeValues: {
						":status": status,
						":readAt": new Date().toISOString(),
					},
				}),
			);
		} else {
			await client.send(
				new UpdateCommand({
					TableName: userArticlesTableName,
					Key: { userId, url: article.url },
					UpdateExpression: "SET #status = :status REMOVE readAt",
					ExpressionAttributeNames: { "#status": "status" },
					ExpressionAttributeValues: { ":status": status },
				}),
			);
		}

		return true;
	};

	const findArticleFreshness: FindArticleFreshness = async (url) => {
		const articleResourceUniqueId = ArticleResourceUniqueId.parse(url);
		const result = await client.send(
			new GetCommand({
				TableName: tableName,
				Key: { url: articleResourceUniqueId.value },
				ProjectionExpression: "etag, lastModified, contentFetchedAt",
			}),
		);
		if (!result.Item) return null;
		/** 1. Convert nullish DynamoDB values to undefined to satisfy the ArticleFreshnessData type contract. */
		const row = ArticleFreshnessRow.parse(result.Item);
		return {
			etag: row.etag ?? undefined, /* 1 */
			lastModified: row.lastModified ?? undefined, /* 1 */
			contentFetchedAt: row.contentFetchedAt ?? undefined, /* 1 */
		};
	};

	/** Legacy fallback for articles saved before S3 migration. S3 is the primary content store. */
	const readContent: ContentProvider = async (articleResourceUniqueId) => {
		const result = await client.send(
			new GetCommand({
				TableName: tableName,
				Key: { url: articleResourceUniqueId.value },
				ProjectionExpression: "content",
			}),
		);
		if (!result.Item) return undefined;
		const parsed = ArticleContentRow.parse(result.Item);
		return parsed.content;
	};

	return {
		saveArticle,
		findArticleById,
		findArticlesByUser,
		deleteArticle,
		updateArticleStatus,
		findArticleFreshness,
		readContent,
	};
}
/* c8 ignore stop */
