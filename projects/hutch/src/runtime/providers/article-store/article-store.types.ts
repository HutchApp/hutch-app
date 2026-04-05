import type {
	ArticleId,
	ArticleStatus,
	SavedArticle,
} from "../../domain/article/article.types";
import type { UserId } from "../../domain/user/user.types";

export interface SaveArticleParams {
	userId: UserId;
	url: string;
	metadata: SavedArticle["metadata"];
	content?: string;

	estimatedReadTime: SavedArticle["estimatedReadTime"];
}

type SortField = "savedAt";
export type SortOrder = "asc" | "desc";

export interface FindArticlesQuery {
	userId: UserId;
	status?: ArticleStatus;
	sort?: SortField;
	order?: SortOrder;
	page?: number;
	pageSize?: number;
}

export interface FindArticlesResult {
	articles: SavedArticle[];
	total: number;
	page: number;
	pageSize: number;
}

export type SaveArticle = (params: SaveArticleParams) => Promise<SavedArticle>;

export type FindArticleById = (
	id: ArticleId,
	userId: UserId,
) => Promise<SavedArticle | null>;

export interface GlobalArticleData {
	id: ArticleId;
	url: string;
	metadata: SavedArticle["metadata"];
	content?: string;

	estimatedReadTime: SavedArticle["estimatedReadTime"];
}

export type FindArticleByUrl = (
	url: string,
) => Promise<GlobalArticleData | null>;

export type FindArticlesByUser = (
	query: FindArticlesQuery,
) => Promise<FindArticlesResult>;

export type DeleteArticle = (
	id: ArticleId,
	userId: UserId,
) => Promise<boolean>;

export type UpdateArticleStatus = (
	id: ArticleId,
	userId: UserId,
	status: ArticleStatus,
) => Promise<boolean>;

export interface ArticleFreshnessData {
	etag?: string;
	lastModified?: string;
	contentFetchedAt?: string;
}

export type FindArticleFreshness = (
	url: string,
) => Promise<ArticleFreshnessData | null>;

export type UpdateArticleContent = (params: {
	url: string;
	metadata: SavedArticle["metadata"];
	content?: string;

	estimatedReadTime: SavedArticle["estimatedReadTime"];
	etag?: string;
	lastModified?: string;
	contentFetchedAt: string;
}) => Promise<void>;

export type UpdateArticleFetchMetadata = (params: {
	url: string;
	contentFetchedAt: string;
}) => Promise<void>;

export type ClearArticleSummary = (url: string) => Promise<void>;
