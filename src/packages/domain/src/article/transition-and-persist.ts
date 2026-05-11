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
}

/**
 * Single orchestration for every aggregate write: load → run pure transition →
 * version-CAS save → all-or-nothing effect dispatch. The contract a handler
 * gets is "if I returned, the storage write AND the effect dispatch both
 * succeeded; if anything failed I threw, my SQS message stays in flight and
 * is redelivered."
 *
 * 1. Rebase-and-retry on AggregateConcurrencyError. The retry budget is
 *    deliberately small: the racy writers in production are the canary scan,
 *    the canary recovery path, and the operator recrawl — none generate more
 *    than a handful of concurrent writes to the same URL. If the conflict
 *    metric (emitted by the DDB adapter) shows the budget is wrong, tune
 *    here rather than per-handler.
 * 2. The dispatcher MUST throw on any failure so SQS redelivers. On
 *    redelivery this orchestration runs again — the now-persisted aggregate
 *    is reloaded, the transition is re-applied (idempotent because the
 *    aggregate already reflects the change), and the effects are
 *    re-dispatched. Consumers already de-duplicate via the existing
 *    at-least-once EventBridge contract.
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
	): Promise<Article> {
		const article = await deps.store.load(params.url);
		assert(
			article,
			`Cannot run transition: no aggregate found for ${params.url}`,
		);

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
	): Promise<Article> {
		return attempt(params, retryBudget);
	};
}
