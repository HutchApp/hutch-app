import { ArticleResourceUniqueId } from "@packages/article-resource-unique-id";
import { AggregateConcurrencyError } from "@packages/domain/article";
import type { Article, ArticleStore } from "@packages/domain/article";

export interface InMemoryArticleStore extends ArticleStore {
	/**
	 * Seeds an aggregate at a chosen version. Use to set up pre-transition
	 * state in tests; production code never calls this.
	 */
	seed: (article: Article) => void;
	/** Returns the current in-memory snapshot (after any saves). */
	peek: (url: string) => Article | undefined;
}

/**
 * In-memory ArticleStore for tests. Models the version-CAS semantics of the
 * production DDB adapter:
 *
 * - `load` returns the current snapshot (or undefined).
 * - `save({article, expectedVersion})` succeeds iff the current on-disk
 *   version equals `expectedVersion`, then writes
 *   `{ ...article, version: expectedVersion + 1 }`.
 * - On mismatch it throws `AggregateConcurrencyError` — the same error the
 *   DDB adapter raises when the `ConditionExpression: version = :expected`
 *   condition fails.
 *
 * Tests that want to simulate a concurrent writer call `seed(...)` to bump
 * the version between a handler's load and save without having to wire a
 * second handler.
 */
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
