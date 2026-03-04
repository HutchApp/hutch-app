import { randomBytes } from "node:crypto";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
	PutCommand,
	GetCommand,
	QueryCommand,
	DeleteCommand,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type {
	ArticleId,
	ArticleStatus,
	Minutes,
	SavedArticle,
} from "../../domain/article/article.types";
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

function fromItem(item: Record<string, unknown>): SavedArticle {
	return {
		id: item.id as ArticleId,
		userId: item.userId as SavedArticle["userId"],
		url: item.url as string,
		metadata: {
			title: item.title as string,
			siteName: item.siteName as string,
			excerpt: item.excerpt as string,
			wordCount: item.wordCount as number,
			imageUrl: item.imageUrl as string | undefined,
		},
		content: item.content as string | undefined,
		estimatedReadTime: item.estimatedReadTime as Minutes,
		status: item.status as ArticleStatus,
		savedAt: new Date(item.savedAt as string),
		readAt: item.readAt ? new Date(item.readAt as string) : undefined,
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
		const id = randomBytes(16).toString("hex") as ArticleId;
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

		// Get accurate total count with a separate COUNT query
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
