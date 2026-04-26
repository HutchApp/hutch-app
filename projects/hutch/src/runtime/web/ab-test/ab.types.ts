import { z } from "zod";

export const VisitorIdSchema = z
	.string()
	.regex(/^[0-9a-f]{32}$/, "VisitorId must be a 32-char hex string")
	.brand<"VisitorId">();
export type VisitorId = z.infer<typeof VisitorIdSchema>;

export const HOMEPAGE_VARIANTS = ["control", "treatment-founding-cta"] as const;
export type HomepageVariant = (typeof HOMEPAGE_VARIANTS)[number];

export const HOMEPAGE_EXPERIMENT_ID = "homepage-cta-2026-04";

declare global {
	namespace Express {
		interface Request {
			abVisitorId?: VisitorId;
			abHomepageVariant?: HomepageVariant;
		}
	}
}
