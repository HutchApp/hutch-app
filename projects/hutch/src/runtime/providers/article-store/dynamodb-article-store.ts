import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
	PutCommand,
	GetCommand,
	QueryCommand,
	DeleteCommand,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { SavedArticle } from "../../domain/article/article.types";
import { ArticleIdSchema, MinutesSchema, ArticleStatusSchema } from "../../domain/article/article.schema";
import { UserIdSchema } from "../../domain/user/user.schema";
import type {
	DeleteArticle,
	FindArticleById,
	FindArticlesByUser,
	SaveArticle,
	UpdateArticleStatus,
} from "./article-store.types";

function toItem(article: SavedArticle): Record<string, unknown> {
	return {
		id: article.id,
		userId: article.userId,
		url: article.url,
		title: article.metadata.title,
		siteName: article.metadata.siteName,
		excerpt: article.metadata.excerpt,
		wordCount: article.metadata.wordCount,
		imageUrl: article.metadata.imageUrl,
		content: article.content,
		estimatedReadTime: article.estimatedReadTime,
		status: article.status,
		savedAt: article.savedAt.toISOString(),
		readAt: article.readAt?.toISOString(),
	};
}

const SavedArticleRow = z.object({
	id: ArticleIdSchema,
	userId: UserIdSchema,
	url: z.string(),
	title: z.string(),
	siteName: z.string(),
	excerpt: z.string(),
	wordCount: z.number(),
	imageUrl: z.string().optional(),
	content: z.string().optional(),
	estimatedReadTime: MinutesSchema,
	status: ArticleStatusSchema,
	savedAt: z.string(),
	readAt: z.string().optional(),
});

function fromItem(item: Record<string, unknown>): SavedArticle {
	const row = SavedArticleRow.parse(item);
	return {
		id: row.id,
		userId: row.userId,
		url: row.url,
		metadata: {
			title: row.title,
			siteName: row.siteName,
			excerpt: row.excerpt,
			wordCount: row.wordCount,
			imageUrl: row.imageUrl,
		},
		content: row.content,
		estimatedReadTime: row.estimatedReadTime,
		status: row.status,
		savedAt: new Date(row.savedAt),
		readAt: row.readAt ? new Date(row.readAt) : undefined,
	};
}

export function initDynamoDbArticleStore(deps: {
	client: DynamoDBDocumentClient;
	tableName: string;
}): {
	saveArticle: SaveArticle;
	findArticleById: FindArticleById;
	findArticlesByUser: FindArticlesByUser;
	deleteArticle: DeleteArticle;
	updateArticleStatus: UpdateArticleStatus;
} {
	const { client, tableName } = deps;

	const saveArticle: SaveArticle = async (params) => {
		const id = ArticleIdSchema.parse(randomBytes(16).toString("hex"));
		const article: SavedArticle = {
			id,
			userId: params.userId,
			url: params.url,
			metadata: params.metadata,
			content: params.content,
			estimatedReadTime: params.estimatedReadTime,
			status: "unread",
			savedAt: new Date(),
		};

		await client.send(
			new PutCommand({ TableName: tableName, Item: toItem(article) }),
		);

		return article;
	};

	const findArticleById: FindArticleById = async (id) => {
		const result = await client.send(
			new GetCommand({ TableName: tableName, Key: { id } }),
		);
		if (!result.Item) return null;
		return fromItem(result.Item);
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

		const itemsToSkip = (page - 1) * pageSize;
		const articles: SavedArticle[] = [];
		let exclusiveStartKey: Record<string, unknown> | undefined;
		let skippedCount = 0;

		// DynamoDB paginated queries cannot know total count upfront
		let total = 0;
		let countStartKey: Record<string, unknown> | undefined;
		do {
			const countResult = await client.send(
				new QueryCommand({
					TableName: tableName,
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

		// Paginate through results using DynamoDB's native pagination
		do {
			const result = await client.send(
				new QueryCommand({
					TableName: tableName,
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
				} else if (articles.length < pageSize) {
					articles.push(fromItem(item));
				}
			}

			exclusiveStartKey = result.LastEvaluatedKey as
				| Record<string, unknown>
				| undefined;

			// Stop if we have enough items for the requested page
			if (articles.length >= pageSize && !exclusiveStartKey) {
				break;
			}
		} while (
			exclusiveStartKey &&
			(skippedCount < itemsToSkip || articles.length < pageSize)
		);

		return { articles, total, page, pageSize };
	};

	const deleteArticle: DeleteArticle = async (id, userId) => {
		const existing = await findArticleById(id);
		if (!existing || existing.userId !== userId) {
			return false;
		}

		await client.send(
			new DeleteCommand({ TableName: tableName, Key: { id } }),
		);
		return true;
	};

	const updateArticleStatus: UpdateArticleStatus = async (
		id,
		userId,
		status,
	) => {
		const existing = await findArticleById(id);
		if (!existing || existing.userId !== userId) {
			return false;
		}

		if (status === "read") {
			await client.send(
				new UpdateCommand({
					TableName: tableName,
					Key: { id },
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
					TableName: tableName,
					Key: { id },
					UpdateExpression: "SET #status = :status REMOVE readAt",
					ExpressionAttributeNames: { "#status": "status" },
					ExpressionAttributeValues: { ":status": status },
				}),
			);
		}

		return true;
	};

	return {
		saveArticle,
		findArticleById,
		findArticlesByUser,
		deleteArticle,
		updateArticleStatus,
	};
}
