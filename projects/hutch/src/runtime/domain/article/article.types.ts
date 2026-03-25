import type { UserId } from "../user/user.types";

export type ArticleId = string & { readonly __brand: "ArticleId" };
export type Minutes = number & { readonly __brand: "Minutes" };

export type ArticleStatus = "unread" | "read";

export interface ArticleMetadata {
	title: string;
	siteName: string;
	excerpt: string;
	wordCount: number;
	imageUrl?: string;
}

export interface SavedArticle {
	id: ArticleId;
	userId: UserId;
	url: string;
	metadata: ArticleMetadata;
	content?: string;
	estimatedReadTime: Minutes;
	status: ArticleStatus;
	savedAt: Date;
	readAt?: Date;
}
