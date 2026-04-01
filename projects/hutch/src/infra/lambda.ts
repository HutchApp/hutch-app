import { createHutchApp } from "../runtime/app";
import { initFetchHtml } from "../runtime/providers/article-parser/fetch-html";
import { initReadabilityParser } from "../runtime/providers/article-parser/readability-parser";
import { lambdaExpress } from "./lambda-express";

const logError = (message: string, error?: Error) => console.error(JSON.stringify({ level: "ERROR", timestamp: new Date().toISOString(), message, stack: error?.stack }));
const fetchHtml = initFetchHtml({ fetch: globalThis.fetch, logError });
const { parseArticle } = initReadabilityParser({ fetchHtml });
const { app } = createHutchApp({ parseArticle });

export const handler = lambdaExpress({ app });
