import assert from "node:assert";
import type { Article } from "./aggregate.types";
import type { DispatchEffects } from "./effect.types";
import type { ArticleStore } from "./storage.types";
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
 * Single orchestration for every aggregate write: load → run pure transition →
 * save → all-or-nothing effect dispatch. The contract a handler gets is "if I
 * returned, the storage write AND the effect dispatch both succeeded; if
 * anything failed I threw, my SQS message stays in flight and is redelivered."
 *
 * Last-write-wins: concurrent writers to the same URL overwrite each other.
 * The dispatcher MUST throw on any failure so SQS redelivers.
 */
export interface TransitionAndPersistDeps {
	store: ArticleStore;
	dispatcher: DispatchEffects;
}

export function initTransitionAndPersist(deps: TransitionAndPersistDeps) {
	return async function transitionAndPersist<P>(
		params: TransitionAndPersistParams<P>,
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

		await deps.store.save(result.article);
		await deps.dispatcher(result.effects);
		return result.article;
	};
}
