import { randomBytes } from "node:crypto";
import type {
	ArticleId,
	SavedArticle,
} from "../../domain/article/article.types";
import type {
	DeleteArticle,
	FindArticleById,
	FindArticlesByUser,
	SaveArticle,
	UpdateArticleStatus,
} from "./article-store.types";

export function initInMemoryArticleStore(): {
	saveArticle: SaveArticle;
	findArticleById: FindArticleById;
	findArticlesByUser: FindArticlesByUser;
	deleteArticle: DeleteArticle;
	updateArticleStatus: UpdateArticleStatus;
} {
	const articles = new Map<ArticleId, SavedArticle>();

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
		articles.set(id, article);
		return article;
	};

	const findArticleById: FindArticleById = async (id) => {
		return articles.get(id) ?? null;
	};

	const findArticlesByUser: FindArticlesByUser = async (query) => {
		const page = query.page ?? 1;
		const pageSize = query.pageSize ?? 20;
		const order = query.order ?? "desc";

		let filtered = Array.from(articles.values()).filter(
			(a) => a.userId === query.userId,
		);

		if (query.status) {
			filtered = filtered.filter((a) => a.status === query.status);
		}

		filtered.sort((a, b) => {
			const diff = a.savedAt.getTime() - b.savedAt.getTime();
			return order === "asc" ? diff : -diff;
		});

		const total = filtered.length;
		const start = (page - 1) * pageSize;
		const paginated = filtered.slice(start, start + pageSize);

		return { articles: paginated, total, page, pageSize };
	};

	const deleteArticle: DeleteArticle = async (id, userId) => {
		const article = articles.get(id);
		if (!article || article.userId !== userId) {
			return false;
		}
		articles.delete(id);
		return true;
	};

	const updateArticleStatus: UpdateArticleStatus = async (
		id,
		userId,
		status,
	) => {
		const article = articles.get(id);
		if (!article || article.userId !== userId) {
			return false;
		}
		article.status = status;
		article.readAt = status === "read" ? new Date() : undefined;
		articles.set(id, article);
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
