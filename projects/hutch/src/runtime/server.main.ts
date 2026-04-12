import { createHutchApp } from "./app";
import { DEFAULT_CRAWL_HEADERS, initCrawlArticle } from "./providers/article-parser/crawl-article";
import { initReadabilityParser } from "./providers/article-parser/readability-parser";
import { PORT } from "./server";

const logError = (message: string, error?: Error) => console.error(JSON.stringify({ level: "ERROR", timestamp: new Date().toISOString(), message, stack: error?.stack }));
const crawlArticle = initCrawlArticle({ fetch: globalThis.fetch, logError, headers: { ...DEFAULT_CRAWL_HEADERS } });
const { parseArticle } = initReadabilityParser({ crawlArticle });
const { app } = createHutchApp({ parseArticle });

app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});
