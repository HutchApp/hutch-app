/**
 * Re-exports of the contracts the in-memory implementations satisfy. Tests
 * import from `@packages/test-fixtures/providers/article-aggregate` for both
 * the contracts and the fixtures; this file is the single point that pins the
 * relationship between test fixtures and the real domain shapes.
 */
export type {
	Article,
	ArticleStore,
	LoadArticle,
	CrawlState,
	SummaryState,
	Effect,
	DispatchEffects,
	SaveAggregateArticle,
	SaveAggregateArticleParams,
} from "@packages/domain/article";
export { AggregateConcurrencyError } from "@packages/domain/article";
