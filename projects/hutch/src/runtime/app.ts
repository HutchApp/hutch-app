import type { Express } from "express";
import type { Logger } from "../infra/logger";
import { initInMemoryAuth } from "./providers/auth/in-memory-auth";
import { initInMemoryArticleStore } from "./providers/article-store/in-memory-article-store";
import { initStaticParser } from "./providers/article-parser/static-parser";
import type { FetchHtml } from "./providers/article-parser/static-parser";
import { createApp } from "./server";
import { getEnv } from "./require-env";

const FETCH_TIMEOUT_MS = 5000;

const fetchHtml: FetchHtml = async (url) => {
	try {
		const response = await fetch(url, {
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
			headers: { accept: "text/html" },
		});
		if (!response.ok) return undefined;
		const contentType = response.headers.get("content-type") ?? "";
		if (!contentType.includes("text/html")) return undefined;
		return await response.text();
	} catch {
		return undefined;
	}
};

export const app = createApp({
	...initInMemoryAuth(),
	...initInMemoryArticleStore(),
	...initStaticParser({ fetchHtml }),
});

export const localServer = (expressApp: Express, logger: Logger): void => {
	const port = getEnv("PORT") || "3000";
	expressApp.listen(Number.parseInt(port, 10), () => {
		logger.info(`Local server running on http://localhost:${port}`);
	});
};
