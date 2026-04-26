import type { NextFunction, Request, RequestHandler, Response } from "express";
import { isCrawler } from "../../is-crawler";
import {
	AB_VISITOR_COOKIE_NAME,
	AB_VISITOR_COOKIE_OPTIONS,
} from "./ab-cookie";
import { assignHomepageVariant } from "./assign-variant";
import type { GenerateVisitorId } from "./visitor-id";
import { parseVisitorId } from "./visitor-id";

interface AbMiddlewareDeps {
	generateVisitorId: GenerateVisitorId;
}

/** Metadata routes that don't render a variant — skip the cookie + sha256 work and don't tag a non-page hit with a variant. */
const SKIP_PATHS = new Set([
	"/robots.txt",
	"/sitemap.xml",
	"/llms.txt",
	"/llms-full.txt",
	"/favicon.ico",
]);

/**
 * Bots are pinned to "control" with no cookie write — the experiment isn't
 * polluted by crawler traffic and Googlebot sees a stable response across
 * crawls so the indexed homepage doesn't oscillate between variants and
 * confuse SEO rank signals.
 */
export function createAbMiddleware(deps: AbMiddlewareDeps): RequestHandler {
	return (req: Request, res: Response, next: NextFunction): void => {
		if (SKIP_PATHS.has(req.path)) {
			next();
			return;
		}

		if (isCrawler(req)) {
			req.abHomepageVariant = "control";
			next();
			return;
		}

		const existing = parseVisitorId(req.cookies?.[AB_VISITOR_COOKIE_NAME]);
		const visitorId = existing ?? deps.generateVisitorId();

		if (!existing) {
			res.cookie(AB_VISITOR_COOKIE_NAME, visitorId, AB_VISITOR_COOKIE_OPTIONS);
		}

		req.abVisitorId = visitorId;
		req.abHomepageVariant = assignHomepageVariant(visitorId);
		next();
	};
}
