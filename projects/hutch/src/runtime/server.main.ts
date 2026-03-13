import { createHutchApp } from "./app";
import { fetchHtml } from "./providers/article-parser/fetch-html";
import { initReadabilityParser } from "./providers/article-parser/readability-parser";
import { PORT } from "./server";

const { parseArticle } = initReadabilityParser({ fetchHtml });
const { app } = createHutchApp({ parseArticle });

app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});
