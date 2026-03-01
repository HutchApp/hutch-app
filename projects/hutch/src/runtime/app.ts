import type { Express } from "express";
import type { Logger } from "../infra/logger";
import { initInMemoryAuth } from "./providers/auth/in-memory-auth";
import { initInMemoryArticleStore } from "./providers/article-store/in-memory-article-store";
import { initStaticParser } from "./providers/article-parser/static-parser";
import { createApp } from "./server";
import { getEnv } from "./require-env";

export const app = createApp({
	...initInMemoryAuth(),
	...initInMemoryArticleStore(),
	...initStaticParser(),
});

export const localServer = (expressApp: Express, logger: Logger): void => {
	const port = getEnv("PORT") || "3000";
	expressApp.listen(Number.parseInt(port, 10), () => {
		logger.info(`Local server running on http://localhost:${port}`);
	});
};
