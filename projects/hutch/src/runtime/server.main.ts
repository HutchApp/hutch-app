import { createHutchApp } from "./app";
import { initFetchHtml } from "./providers/article-parser/fetch-html";
import { initReadabilityParser } from "./providers/article-parser/readability-parser";
import { PORT } from "./server";

const logError = (message: string, error?: Error) => console.error(JSON.stringify({ level: "ERROR", timestamp: new Date().toISOString(), message, stack: error?.stack }));
const fetchHtml = initFetchHtml({ fetch: globalThis.fetch, logError });
const { parseArticle } = initReadabilityParser({ fetchHtml });
const { app } = createHutchApp({ parseArticle });

app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});
