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

		if (query.status) {
			filterExpression = "#status = :status";
			expressionValues[":status"] = query.status;
		}

		const result = await client.send(
			new QueryCommand({
				TableName: tableName,
				IndexName: "userId-savedAt-index",
				KeyConditionExpression: "userId = :userId",
				FilterExpression: filterExpression,
				ExpressionAttributeValues: expressionValues,
				ExpressionAttributeNames: {
					"#status": "status",
				},
				ScanIndexForward: order === "asc",
			}),
		);

		const articles = (result.Items ?? []).map(fromItem);
		const total = articles.length;
		const start = (page - 1) * pageSize;
		const paginated = articles.slice(start, start + pageSize);

		return { articles: paginated, total, page, pageSize };
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

		const readAt = status === "read" ? new Date().toISOString() : null;

		await client.send(
			new UpdateCommand({
				TableName: tableName,
				Key: { id },
				UpdateExpression:
					"SET #status = :status, readAt = :readAt",
				ExpressionAttributeNames: { "#status": "status" },
				ExpressionAttributeValues: { ":status": status, ":readAt": readAt },
			}),
		);

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
