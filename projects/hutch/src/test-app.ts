import { initInMemoryAuth } from "./providers/auth/in-memory-auth";
import { initInMemoryArticleStore } from "./providers/article-store/in-memory-article-store";
import { initStaticParser } from "./providers/article-parser/static-parser";
import { createApp } from "./server";

export function createTestApp() {
	const auth = initInMemoryAuth();
	const articleStore = initInMemoryArticleStore();
	const parser = initStaticParser();

	const app = createApp({
		...auth,
		...articleStore,
		...parser,
	});

	return { app, auth, articleStore, parser };
}
