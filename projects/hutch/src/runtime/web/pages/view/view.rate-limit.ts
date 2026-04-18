import assert from "node:assert";
import type { RequestHandler } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";

export function initViewArticleRateLimit(deps: {
	windowMs: number;
	limit: number;
}): RequestHandler {
	return rateLimit({
		windowMs: deps.windowMs,
		limit: deps.limit,
		standardHeaders: false,
		legacyHeaders: false,
		keyGenerator: (req) => {
			assert(req.ip, "req.ip must be populated by express");
			return `${ipKeyGenerator(req.ip)}:${req.path}`;
		},
		handler: (_req, res) => {
			res.status(429).end();
		},
	});
}
