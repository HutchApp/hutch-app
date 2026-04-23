import assert from "node:assert";
import type {
	ArticleMetadata,
	ArticleStatus,
	Minutes,
	SavedArticle,
} from "../../domain/article/article.types";
import { ArticleResourceUniqueId } from "@packages/article-resource-unique-id";
import { ReaderArticleHashId } from "../../domain/article/reader-article-hash-id";
import type { UserId } from "../../domain/user/user.types";
import type {
	DeleteArticle,
	FindArticleById,
	FindArticleByUrl,
	FindArticleFreshness,
	FindArticlesByUser,
	SaveArticle,
	SaveArticleGlobally,
	UpdateArticleStatus,
} from "./article-store.types";
import type { ContentProvider } from "./read-article-content";

interface GlobalArticle {
	url: string;
	originalUrl: string;
	routeId: ReaderArticleHashId;
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
	saveArticleGlobally: SaveArticleGlobally;
	findArticleById: FindArticleById;
	findArticleByUrl: FindArticleByUrl;
	findArticleFreshness: FindArticleFreshness;
	findArticlesByUser: FindArticlesByUser;
	deleteArticle: DeleteArticle;
	updateArticleStatus: UpdateArticleStatus;
	readContent: ContentProvider;
	writeContent: (params: { url: string; content: string }) => Promise<void>;
	writeMetadata: (params: { url: string; metadata: ArticleMetadata; estimatedReadTime: Minutes }) => Promise<void>;
} {
	const articles = new Map<string, GlobalArticle>();
	const userArticles = new Map<string, UserArticle>();

	function userArticleKey(userId: UserId, url: string): string {
		return `${userId}:${url}`;
	}

	function findArticleByRouteId(routeId: ReaderArticleHashId): GlobalArticle | undefined {
		for (const article of articles.values()) {
			if (article.routeId.value === routeId.value) return article;
		}
		return undefined;
	}

	const saveArticleGlobally: SaveArticleGlobally = async (params) => {
		const articleResourceUniqueId = ArticleResourceUniqueId.parse(params.url);
		const routeId = ReaderArticleHashId.from(params.url);

		if (!articles.has(articleResourceUniqueId.value)) {
			articles.set(articleResourceUniqueId.value, {
				url: articleResourceUniqueId.value,
				originalUrl: params.url,
				routeId,
				metadata: params.metadata,
				estimatedReadTime: params.estimatedReadTime,
			});
		}
	};

	const saveArticle: SaveArticle = async (params) => {
		await saveArticleGlobally({
			url: params.url,
			metadata: params.metadata,
			estimatedReadTime: params.estimatedReadTime,
		});
		const articleResourceUniqueId = ArticleResourceUniqueId.parse(params.url);

		const uaKey = userArticleKey(params.userId, articleResourceUniqueId.value);
		const existing = userArticles.get(uaKey);
		userArticles.set(uaKey, existing
			? { ...existing, savedAt: new Date() }
			: {
				userId: params.userId,
				url: articleResourceUniqueId.value,
				status: "unread",
				savedAt: new Date(),
			});

		const article = articles.get(articleResourceUniqueId.value);
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
		const articleResourceUniqueId = ArticleResourceUniqueId.parse(url);
		const article = articles.get(articleResourceUniqueId.value);
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
		const articleResourceUniqueId = ArticleResourceUniqueId.parse(url);
		const article = articles.get(articleResourceUniqueId.value);
		if (!article) return null;
		return {
			etag: article.etag,
			lastModified: article.lastModified,
			contentFetchedAt: article.contentFetchedAt,
		};
	};

	const readContent: ContentProvider = async (articleResourceUniqueId) => {
		const article = articles.get(articleResourceUniqueId.value);
		if (!article) return undefined;
		return article.content;
	};

	const writeContent = async (params: { url: string; content: string }) => {
		const articleResourceUniqueId = ArticleResourceUniqueId.parse(params.url);
		const article = articles.get(articleResourceUniqueId.value);
		assert(article, `Article not found for URL: ${articleResourceUniqueId.value}`);
		article.content = params.content;
	};

	const writeMetadata = async (params: { url: string; metadata: ArticleMetadata; estimatedReadTime: Minutes }) => {
		const articleResourceUniqueId = ArticleResourceUniqueId.parse(params.url);
		const article = articles.get(articleResourceUniqueId.value);
		assert(article, `Article not found for URL: ${articleResourceUniqueId.value}`);
		article.metadata = params.metadata;
		article.estimatedReadTime = params.estimatedReadTime;
	};

	return {
		saveArticle,
		saveArticleGlobally,
		findArticleById,
		findArticleByUrl,
		findArticleFreshness,
		findArticlesByUser,
		deleteArticle,
		updateArticleStatus,
		readContent,
		writeContent,
		writeMetadata,
	};
}
