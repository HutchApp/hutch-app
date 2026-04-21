import type { Handler } from "aws-lambda";
import type { Request, Response } from "express";
import express from "express";
import helmet from "helmet";
import compression from "compression";
import serverless from "serverless-http";
import { HutchLogger, consoleLogger } from "@packages/hutch-logger";
import { DEFAULT_CRAWL_HEADERS, initCrawlArticle } from "@packages/crawl-article";
import { logger as requestLogger } from "./logger";
import { type AnalyticsPageview, createAnalyticsMiddleware, hashIp } from "./analytics";
import { createBanMiddleware } from "./ban";
import { logAndRespondOnError } from "./error-handler";
import { createHutchApp, localServer } from "./app";
import { initReadabilityParser } from "./providers/article-parser/readability-parser";
import { getEnv, requireEnv } from "./require-env";

// present in Lambda runtime, absent locally — https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html#configuration-envvars-runtime
const lambda = !!getEnv("AWS_LAMBDA_FUNCTION_NAME");

const logError = (message: string, error?: Error) => console.error(JSON.stringify({ level: "ERROR", timestamp: new Date().toISOString(), message, stack: error?.stack }));
const crawlArticle = initCrawlArticle({ fetch: globalThis.fetch, logError, headers: { ...DEFAULT_CRAWL_HEADERS } });
const { parseArticle } = initReadabilityParser({ crawlArticle });
const { app } = createHutchApp({ parseArticle });

const log = requestLogger();
const logger = HutchLogger.from(consoleLogger);
const salt = requireEnv("ANALYTICS_SALT");
const ban = createBanMiddleware({ salt, hashIp });
const analytics = createAnalyticsMiddleware({
	logger: HutchLogger.fromJSON<AnalyticsPageview>(),
	salt,
	now: () => new Date(),
});

const application = express()
	.disable("x-powered-by")
	.use(helmet({ contentSecurityPolicy: false }))
	.use(
		compression({
			filter: (req: Request, res: Response) =>
				lambda ? compression.filter(req, res) : false,
		}),
	)
	.use(ban)
	.use(analytics)
	.use(app)
	.use(logAndRespondOnError(logger));

if (!lambda) {
	localServer(application, log);
}

export const handler: Handler = lambda ? serverless(application) : () => {};
