import { ArticleResourceUniqueId } from "@packages/article-resource-unique-id";
import { AggregateConcurrencyError } from "@packages/domain/article";
import type { Article, ArticleStore } from "@packages/domain/article";

export interface InMemoryArticleStore extends ArticleStore {
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
		save: async ({ article, expectedVersion }) => {
			const key = canonical(article.url);
			const current = aggregates.get(key);
			const onDiskVersion = current?.version ?? 0;
			if (onDiskVersion !== expectedVersion) {
				throw new AggregateConcurrencyError({
					url: article.url,
					expectedVersion,
				});
			}
			aggregates.set(key, { ...article, version: expectedVersion + 1 });
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
