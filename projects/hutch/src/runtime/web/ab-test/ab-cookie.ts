export const AB_VISITOR_COOKIE_NAME = "hutch_ab_visitor";

/** 1 year in ms — assignment must remain stable so returning visitors see the same variant. */
export const AB_VISITOR_COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

export const AB_VISITOR_COOKIE_OPTIONS = {
	httpOnly: true,
	sameSite: "lax" as const,
	path: "/",
	maxAge: AB_VISITOR_COOKIE_MAX_AGE_MS,
};
