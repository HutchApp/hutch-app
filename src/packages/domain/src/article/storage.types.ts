import type { Article } from "./aggregate.types";

export type LoadArticle = (url: string) => Promise<Article | undefined>;

export type SaveArticle = (article: Article) => Promise<void>;

export interface ArticleStore {
	load: LoadArticle;
	save: SaveArticle;
}
