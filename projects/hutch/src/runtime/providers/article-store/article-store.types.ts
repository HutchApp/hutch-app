import type {
	ArticleStatus,
	SavedArticle,
} from "../../domain/article/article.types";
import type { ReaderArticleHashId } from "../../domain/article/reader-article-hash-id";
import type { UserId } from "../../domain/user/user.types";

export interface SaveArticleParams {
	userId: UserId;
	url: string;
	metadata: SavedArticle["metadata"];
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

export interface SaveArticleGloballyParams {
	url: string;
	metadata: SavedArticle["metadata"];
	estimatedReadTime: SavedArticle["estimatedReadTime"];
}

export type SaveArticleGlobally = (
	params: SaveArticleGloballyParams,
) => Promise<void>;

export type FindArticleById = (
	id: ReaderArticleHashId,
	userId: UserId,
) => Promise<SavedArticle | null>;

export interface GlobalArticleData {
	id: ReaderArticleHashId;
	url: string;
	metadata: SavedArticle["metadata"];
	estimatedReadTime: SavedArticle["estimatedReadTime"];
}

export type FindArticleByUrl = (
	url: string,
) => Promise<GlobalArticleData | null>;

export type FindArticlesByUser = (
	query: FindArticlesQuery,
) => Promise<FindArticlesResult>;

export type DeleteArticle = (
	id: ReaderArticleHashId,
	userId: UserId,
) => Promise<boolean>;

export type UpdateArticleStatus = (
	id: ReaderArticleHashId,
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

