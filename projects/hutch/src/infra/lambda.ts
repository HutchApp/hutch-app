import { createHutchApp } from "../runtime/app";
import { fetchHtml } from "../runtime/providers/article-parser/fetch-html";
import { initReadabilityParser } from "../runtime/providers/article-parser/readability-parser";
import { lambdaExpress } from "./lambda-express";

const { parseArticle } = initReadabilityParser({ fetchHtml });
const { app } = createHutchApp({ parseArticle });

export const handler = lambdaExpress({ app });
