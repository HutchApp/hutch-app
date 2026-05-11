import type { Article } from "./aggregate.types";

export type LoadArticle = (url: string) => Promise<Article | undefined>;

export interface SaveArticleParams {
	article: Article;
	expectedVersion: number;
}

export type SaveArticle = (params: SaveArticleParams) => Promise<void>;

export interface ArticleStore {
	load: LoadArticle;
	save: SaveArticle;
}

export class AggregateConcurrencyError extends Error {
	readonly url: string;
	readonly expectedVersion: number;

	constructor(params: { url: string; expectedVersion: number }) {
		super(
			`Aggregate concurrency conflict for ${params.url}: expected version ${params.expectedVersion}`,
		);
		this.name = "AggregateConcurrencyError";
		this.url = params.url;
		this.expectedVersion = params.expectedVersion;
	}
}
