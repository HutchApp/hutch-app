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
		// The library's keyGeneratorIpFallback validator does a string check on
		// keyGenerator.toString() looking for the literal "ipKeyGenerator". The
		// Lambda bundler minifies that imported symbol, so the heuristic produces
		// a false-positive ERR_ERL_KEY_GEN_IPV6 in prod even though the runtime
		// call is correct. See node_modules/express-rate-limit/dist/index.mjs:611.
		validate: { keyGeneratorIpFallback: false },
		handler: (_req, res) => {
			res.status(429).end();
		},
	});
}
