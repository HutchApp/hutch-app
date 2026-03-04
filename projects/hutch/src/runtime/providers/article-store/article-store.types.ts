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
) => Promise<SavedArticle | null>;

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
