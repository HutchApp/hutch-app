import type { DispatchEffects, Effect } from "@packages/domain/article";

export interface InMemoryEffectDispatcher {
	/** The injected dispatcher. */
	dispatch: DispatchEffects;
	/** Every batch the orchestrator has dispatched, in call order. */
	readonly batches: readonly (readonly Effect[])[];
	/** Convenience: flat list of every effect dispatched across all batches. */
	flat: () => readonly Effect[];
	/** Force the next call to throw. Used to test the SQS-retry contract. */
	failNext: (error?: Error) => void;
}

/**
 * In-memory implementation of `DispatchEffects` for unit tests.
 *
 * - Records every batch the orchestrator passes in.
 * - `failNext` queues a one-shot failure so a test can prove that a thrown
 *   dispatcher surfaces to the handler (the contract that closes class #2:
 *   handler success implies dispatch).
 *
 * The dispatcher is intentionally "all-or-nothing per call" — it records the
 * full batch atomically when no failure is queued, and throws without
 * recording anything when a failure is queued. This mirrors the production
 * EventBridge `PutEvents` semantics we promise the orchestrator (Option B in
 * Plan 4: a single batch is either fully published or the handler throws).
 */
export function initInMemoryEffectDispatcher(): InMemoryEffectDispatcher {
	const batches: Effect[][] = [];
	let pendingFailure: Error | undefined;

	const dispatch: DispatchEffects = async (effects) => {
		if (pendingFailure) {
			const err = pendingFailure;
			pendingFailure = undefined;
			throw err;
		}
		batches.push([...effects]);
	};

	return {
		dispatch,
		get batches() {
			return batches;
		},
		flat: () => batches.flat(),
		failNext: (error) => {
			pendingFailure = error ?? new Error("effect dispatcher failure");
		},
	};
}
