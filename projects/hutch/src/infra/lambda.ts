import { createHutchApp } from "../runtime/app";
import { initFetchHtml } from "../runtime/providers/article-parser/fetch-html";
import { initReadabilityParser } from "../runtime/providers/article-parser/readability-parser";
import { lambdaExpress } from "./lambda-express";

const fetchHtml = initFetchHtml({ fetch: globalThis.fetch });
const { parseArticle } = initReadabilityParser({ fetchHtml });
const { app } = createHutchApp({ parseArticle });

export const handler = lambdaExpress({ app });
