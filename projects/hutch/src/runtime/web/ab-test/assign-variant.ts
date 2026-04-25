import { createHash } from "node:crypto";
import {
	HOMEPAGE_EXPERIMENT_ID,
	HOMEPAGE_VARIANTS,
	type HomepageVariant,
	type VisitorId,
} from "./ab.types";

export type AssignHomepageVariant = (visitorId: VisitorId) => HomepageVariant;

/**
 * Deterministic 50/50 assignment: hash(experimentId:visitorId) → first byte → slot.
 * Same visitor always lands on the same variant for a given experimentId, so a
 * returning user sees consistent copy across sessions even after the cookie
 * round-trips through the browser.
 */
export const assignHomepageVariant: AssignHomepageVariant = (visitorId) => {
	const digest = createHash("sha256")
		.update(`${HOMEPAGE_EXPERIMENT_ID}:${visitorId}`)
		.digest();
	const slot = digest[0] % HOMEPAGE_VARIANTS.length;
	return HOMEPAGE_VARIANTS[slot];
};
