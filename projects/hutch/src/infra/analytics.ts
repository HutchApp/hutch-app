import { createHash } from "node:crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { isbot } from "isbot";
import type { HutchLogger } from "@packages/hutch-logger";

export interface AnalyticsPageview {
	stream: "analytics";
	event: "pageview";
	timestamp: string;
	path: string;
	utm_source: string | null;
	utm_medium: string | null;
	utm_campaign: string | null;
	referrer_host: string | null;
	visitor_hash: string | null;
	user_agent: string | null;
}

const SKIP_PATHS = new Set([
	"/robots.txt",
	"/sitemap.xml",
	"/llms.txt",
	"/favicon.ico",
]);

function shouldLog(req: Request, statusCode: number): boolean {
	if (req.method !== "GET") return false;
	if (SKIP_PATHS.has(req.path)) return false;
	if (statusCode >= 400) return false;
	if (isbot(req.get("user-agent"))) return false;
	return true;
}

function extractQueryString(req: Request, name: string): string | null {
	const value = req.query[name];
	return typeof value === "string" ? value : null;
}

function extractReferrerHost(req: Request): string | null {
	const referer = req.get("referer");
	if (!referer) return null;
	try {
		return new URL(referer).hostname;
	} catch {
		return null;
	}
}

export function hashIp(deps: { ip: string | undefined; salt: string }): string | null {
	if (!deps.ip) return null;
	return createHash("sha256")
		.update(deps.ip + deps.salt)
		.digest("hex")
		.slice(0, 16);
}

export function createAnalyticsMiddleware(deps: {
	logger: HutchLogger.Typed<AnalyticsPageview>;
	salt: string;
	now: () => Date;
}): RequestHandler {
	return (req: Request, res: Response, next: NextFunction) => {
		res.on("finish", () => {
			if (!shouldLog(req, res.statusCode)) return;
			deps.logger.info({
				stream: "analytics",
				event: "pageview",
				timestamp: deps.now().toISOString(),
				path: req.path,
				utm_source: extractQueryString(req, "utm_source"),
				utm_medium: extractQueryString(req, "utm_medium"),
				utm_campaign: extractQueryString(req, "utm_campaign"),
				referrer_host: extractReferrerHost(req),
				visitor_hash: hashIp({ ip: req.ip, salt: deps.salt }),
				user_agent: req.get("user-agent") ?? null,
			});
		});
		next();
	};
}
