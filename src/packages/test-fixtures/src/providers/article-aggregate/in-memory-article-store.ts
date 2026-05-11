import { ArticleResourceUniqueId } from "@packages/article-resource-unique-id";
import type { Article, ArticleStore } from "@packages/domain/article";

export interface InMemoryArticleStore extends ArticleStore {
	/**
	 * Seeds an aggregate. Use to set up pre-transition state in tests;
	 * production code never calls this.
	 */
	seed: (article: Article) => void;
	peek: (url: string) => Article | undefined;
}

export function initInMemoryArticleStore(): InMemoryArticleStore {
	const aggregates = new Map<string, Article>();

	function canonical(url: string): string {
		return ArticleResourceUniqueId.parse(url).value;
	}

	const store: InMemoryArticleStore = {
		load: async (url) => {
			return aggregates.get(canonical(url));
		},
		save: async (article) => {
			aggregates.set(canonical(article.url), article);
		},
		seed: (article) => {
			aggregates.set(canonical(article.url), article);
		},
		peek: (url) => {
			return aggregates.get(canonical(url));
		},
	};

	return store;
}
