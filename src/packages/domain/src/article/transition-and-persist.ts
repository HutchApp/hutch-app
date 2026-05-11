import assert from "node:assert";
import type { Article } from "./aggregate.types";
import type { DispatchEffects } from "./effect.types";
import type { ArticleStore } from "./storage.types";
import { AggregateConcurrencyError } from "./storage.types";
import type { TransitionResult } from "./transitions/refresh-content";

export type Transition<P> = (article: Article, params: P) => TransitionResult;

export interface TransitionAndPersistParams<P> {
	url: string;
	transition: Transition<P>;
	params: P;
	/**
	 * If true, the orchestrator resolves to `undefined` when no aggregate
	 * exists for the URL instead of asserting. Used by DLQ handlers that
	 * can fire against URLs whose row was never created (e.g. the original
	 * save-link command failed before writing).
	 */
	skipIfMissing?: boolean;
}

/**
 * 1. The retry budget is deliberately small: the racy writers in production
 *    are the canary scan, the canary recovery path, and the operator
 *    recrawl — none generate more than a handful of concurrent writes to
 *    the same URL. If the conflict metric (emitted by the DDB adapter)
 *    shows the budget is wrong, tune here rather than per-handler.
 * 2. Dispatcher failure surfaces to the handler so SQS redelivers the
 *    input. Consumers already de-duplicate via the existing at-least-once
 *    EventBridge contract.
 */
export interface TransitionAndPersistDeps {
	store: ArticleStore;
	dispatcher: DispatchEffects;
	retryBudget?: number;
}

const DEFAULT_RETRY_BUDGET = 3;

export function initTransitionAndPersist(deps: TransitionAndPersistDeps) {
	const retryBudget = deps.retryBudget ?? DEFAULT_RETRY_BUDGET;

	async function attempt<P>(
		params: TransitionAndPersistParams<P>,
		remaining: number,
	): Promise<Article | undefined> {
		const article = await deps.store.load(params.url);
		if (!article) {
			if (params.skipIfMissing) return undefined;
			assert(
				false,
				`Cannot run transition: no aggregate found for ${params.url}`,
			);
		}

		const result = params.transition(article, params.params);

		try {
			await deps.store.save({
				article: result.article,
				expectedVersion: article.version,
			});
		} catch (err) {
			if (err instanceof AggregateConcurrencyError && remaining > 0) {
				return attempt(params, remaining - 1); /* 1 */
			}
			throw err;
		}

		await deps.dispatcher(result.effects); /* 2 */
		return result.article;
	}

	return async function transitionAndPersist<P>(
		params: TransitionAndPersistParams<P>,
	): Promise<Article | undefined> {
		return attempt(params, retryBudget);
	};
}
