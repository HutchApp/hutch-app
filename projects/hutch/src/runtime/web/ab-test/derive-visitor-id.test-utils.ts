import { type HomepageVariant, type VisitorId, VisitorIdSchema } from "./ab.types";
import { assignHomepageVariant } from "./assign-variant";

/**
 * Search the small space of zero-padded integer-derived visitor ids until one
 * hashes to the requested variant. Lets tests assert on variant-specific
 * markup without hardcoding magic hex strings whose mapping silently rots if
 * the experiment id changes.
 */
export function deriveVisitorIdForVariant(variant: HomepageVariant): VisitorId {
	let i = 0;
	/** Deterministic ~50/50 assignment guarantees a match within a few iterations; an infinite while keeps every line reachable so the helper itself can hit 100% coverage. */
	while (true) {
		const id = VisitorIdSchema.parse(i.toString(16).padStart(32, "0"));
		if (assignHomepageVariant(id) === variant) return id;
		i++;
	}
}
