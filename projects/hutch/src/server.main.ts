import { initInMemoryAuth } from "./providers/auth/in-memory-auth";
import { initInMemoryArticleStore } from "./providers/article-store/in-memory-article-store";
import { initStaticParser } from "./providers/article-parser/static-parser";
import { createApp, PORT } from "./server";

const auth = initInMemoryAuth();
const articleStore = initInMemoryArticleStore();
const parser = initStaticParser();

const app = createApp({
	...auth,
	...articleStore,
	...parser,
});

app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});
