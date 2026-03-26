import { z } from "zod";

const FEATURE_ID_VALUES = [
	"email-link-import",
	"ai-queue-filter",
	"highlights-notes",
	"full-text-search",
	"offline-reading",
	"text-to-speech",
	"newsletter-inbox",
] as const;

export const FeatureIdSchema = z.enum(FEATURE_ID_VALUES).brand<"FeatureId">();
export type FeatureId = z.infer<typeof FeatureIdSchema>;
