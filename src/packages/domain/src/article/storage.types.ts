import type { Article } from "./aggregate.types";

/**
 * Load returns `undefined` when no row exists for the URL; the orchestrator
 * (`transitionAndPersist`) treats that as a precondition failure rather than
 * implicitly creating the aggregate. Every Phase-1 transition operates on an
 * already-saved article — the save-link command path is what creates new
 * aggregates (Phase 3).
 */
export type LoadArticle = (url: string) => Promise<Article | undefined>;

/**
 * `expectedVersion` is the version the caller loaded. The adapter writes
 *   `version = expectedVersion + 1`
 * with `ConditionExpression: version = :expected` (or
 * `attribute_not_exists(version)` when `expectedVersion === 0` — that is, the
 * first aggregate write against a pre-aggregate row). On conflict the adapter
 * throws `AggregateConcurrencyError` so the orchestrator can rebase and retry.
 */
export interface SaveArticleParams {
	article: Article;
	expectedVersion: number;
}

export type SaveArticle = (params: SaveArticleParams) => Promise<void>;

export interface ArticleStore {
	load: LoadArticle;
	save: SaveArticle;
}

/**
 * Thrown by a storage adapter when the conditional write fails because another
 * writer bumped `version` between load and save. Caller's contract: reload the
 * aggregate, re-run the transition, retry the save up to the configured
 * retry budget; then surface to SQS for redelivery if still failing.
 */
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
