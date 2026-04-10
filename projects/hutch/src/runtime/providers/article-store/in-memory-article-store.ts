import assert from "node:assert";
import type {
	ArticleId,
	ArticleMetadata,
	ArticleStatus,
	Minutes,
	SavedArticle,
} from "../../domain/article/article.types";
import { ArticleUniqueId } from "@packages/article-unique-id";
import { ReaderId } from "../../domain/article/reader-id";
import type { UserId } from "../../domain/user/user.types";
import type {
	DeleteArticle,
	FindArticleById,
	FindArticleByUrl,
	FindArticleFreshness,
	FindArticlesByUser,
	SaveArticle,
	UpdateArticleStatus,
} from "./article-store.types";
import type { ContentProvider } from "./read-article-content";

interface GlobalArticle {
	url: string;
	originalUrl: string;
	routeId: ArticleId;
	metadata: ArticleMetadata;
	content?: string;

	estimatedReadTime: Minutes;
	summary?: string;
	etag?: string;
	lastModified?: string;
	contentFetchedAt?: string;
}

interface UserArticle {
	userId: UserId;
	url: string;
	status: ArticleStatus;
	savedAt: Date;
	readAt?: Date;
}

function toSavedArticle(article: GlobalArticle, userArticle: UserArticle): SavedArticle {
	return {
		id: article.routeId,
		userId: userArticle.userId,
		url: article.originalUrl,
		metadata: article.metadata,
		content: article.content,

		estimatedReadTime: article.estimatedReadTime,
		status: userArticle.status,
		savedAt: userArticle.savedAt,
		readAt: userArticle.readAt,
	};
}

export function initInMemoryArticleStore(): {
	saveArticle: SaveArticle;
	findArticleById: FindArticleById;
	findArticleByUrl: FindArticleByUrl;
	findArticleFreshness: FindArticleFreshness;
	findArticlesByUser: FindArticlesByUser;
	deleteArticle: DeleteArticle;
	updateArticleStatus: UpdateArticleStatus;
	readContent: ContentProvider;
	writeContent: (params: { url: string; content: string }) => Promise<void>;
} {
	const articles = new Map<string, GlobalArticle>();
	const userArticles = new Map<string, UserArticle>();

	function userArticleKey(userId: UserId, url: string): string {
		return `${userId}:${url}`;
	}

	function findArticleByRouteId(routeId: ArticleId): GlobalArticle | undefined {
		for (const article of articles.values()) {
			if (article.routeId === routeId) return article;
		}
		return undefined;
	}

	const saveArticle: SaveArticle = async (params) => {
		const articleUniqueId = ArticleUniqueId.parse(params.url);
		const routeId = ReaderId.from(params.url);

		if (!articles.has(articleUniqueId.value)) {
			articles.set(articleUniqueId.value, {
				url: articleUniqueId.value,
				originalUrl: params.url,
				routeId,
				metadata: params.metadata,
				estimatedReadTime: params.estimatedReadTime,
			});
		}

		const uaKey = userArticleKey(params.userId, articleUniqueId.value);
		if (!userArticles.has(uaKey)) {
			userArticles.set(uaKey, {
				userId: params.userId,
				url: articleUniqueId.value,
				status: "unread",
				savedAt: new Date(),
			});
		}

		const article = articles.get(articleUniqueId.value);
		assert(article, "Article must exist after set");
		const ua = userArticles.get(uaKey);
		assert(ua, "User article must exist after set");
		return toSavedArticle(article, ua);
	};

	const findArticleById: FindArticleById = async (id, userId) => {
		const article = findArticleByRouteId(id);
		if (!article) return null;

		const ua = userArticles.get(userArticleKey(userId, article.url));
		if (!ua) return null;

		return toSavedArticle(article, ua);
	};

	const findArticleByUrl: FindArticleByUrl = async (url) => {
		const articleUniqueId = ArticleUniqueId.parse(url);
		const article = articles.get(articleUniqueId.value);
		if (!article) return null;

		return {
			id: article.routeId,
			url: article.originalUrl,
			metadata: article.metadata,
			content: article.content,
	
			estimatedReadTime: article.estimatedReadTime,
		};
	};

	const findArticlesByUser: FindArticlesByUser = async (query) => {
		const page = query.page ?? 1;
		const pageSize = query.pageSize ?? 20;
		const order = query.order ?? "desc";

		let userArts = Array.from(userArticles.values()).filter(
			(ua) => ua.userId === query.userId,
		);

		if (query.status) {
			userArts = userArts.filter((ua) => ua.status === query.status);
		}

		userArts.sort((a, b) => {
			const diff = a.savedAt.getTime() - b.savedAt.getTime();
			return order === "asc" ? diff : -diff;
		});

		const total = userArts.length;
		const start = (page - 1) * pageSize;
		const paginated = userArts.slice(start, start + pageSize);

		const result: SavedArticle[] = [];
		for (const ua of paginated) {
			const article = articles.get(ua.url);
			if (article) {
				result.push(toSavedArticle(article, ua));
			}
		}

		return { articles: result, total, page, pageSize };
	};

	const deleteArticle: DeleteArticle = async (id, userId) => {
		const article = findArticleByRouteId(id);
		if (!article) return false;

		const uaKey = userArticleKey(userId, article.url);
		if (!userArticles.has(uaKey)) return false;

		userArticles.delete(uaKey);
		return true;
	};

	const updateArticleStatus: UpdateArticleStatus = async (id, userId, status) => {
		const article = findArticleByRouteId(id);
		if (!article) return false;

		const uaKey = userArticleKey(userId, article.url);
		const ua = userArticles.get(uaKey);
		if (!ua) return false;

		ua.status = status;
		if (status === "read") {
			ua.readAt = new Date();
		} else {
			ua.readAt = undefined;
		}
		userArticles.set(uaKey, ua);
		return true;
	};

	const findArticleFreshness: FindArticleFreshness = async (url) => {
		const articleUniqueId = ArticleUniqueId.parse(url);
		const article = articles.get(articleUniqueId.value);
		if (!article) return null;
		return {
			etag: article.etag,
			lastModified: article.lastModified,
			contentFetchedAt: article.contentFetchedAt,
		};
	};

	const readContent: ContentProvider = async (articleUniqueId) => {
		const article = articles.get(articleUniqueId.value);
		if (!article) return undefined;
		return article.content;
	};

	const writeContent = async (params: { url: string; content: string }) => {
		const articleUniqueId = ArticleUniqueId.parse(params.url);
		const article = articles.get(articleUniqueId.value);
		assert(article, `Article not found for URL: ${articleUniqueId.value}`);
		article.content = params.content;
	};

	return {
		saveArticle,
		findArticleById,
		findArticleByUrl,
		findArticleFreshness,
		findArticlesByUser,
		deleteArticle,
		updateArticleStatus,
		readContent,
		writeContent,
	};
}
