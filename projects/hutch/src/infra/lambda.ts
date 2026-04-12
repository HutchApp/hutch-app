import { createHutchApp } from "../runtime/app";
import { DEFAULT_CRAWL_HEADERS, initCrawlArticle } from "../runtime/providers/article-parser/crawl-article";
import { initReadabilityParser } from "../runtime/providers/article-parser/readability-parser";
import { lambdaExpress } from "./lambda-express";

const logError = (message: string, error?: Error) => console.error(JSON.stringify({ level: "ERROR", timestamp: new Date().toISOString(), message, stack: error?.stack }));
const crawlArticle = initCrawlArticle({ fetch: globalThis.fetch, logError, headers: { ...DEFAULT_CRAWL_HEADERS } });
const { parseArticle } = initReadabilityParser({ crawlArticle });
const { app } = createHutchApp({ parseArticle });

export const handler = lambdaExpress({ app });
