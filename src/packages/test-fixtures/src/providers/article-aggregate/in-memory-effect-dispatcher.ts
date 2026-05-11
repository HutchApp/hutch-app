import type { DispatchEffects, Effect } from "@packages/domain/article";

export interface InMemoryEffectDispatcher {
	dispatch: DispatchEffects;
	readonly batches: readonly (readonly Effect[])[];
	flat: () => readonly Effect[];
	failNext: (error?: Error) => void;
}

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
