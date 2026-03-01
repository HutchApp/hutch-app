import { initInMemoryAuth } from "../runtime/providers/auth/in-memory-auth";
import { initInMemoryArticleStore } from "../runtime/providers/article-store/in-memory-article-store";
import { initStaticParser } from "../runtime/providers/article-parser/static-parser";
import { createApp } from "../runtime/server";
import { lambdaExpress } from "./lambda-express";

// Provider factory for swapping implementations (e.g., DynamoDB, PostgreSQL)
const createProviders = () => ({
	...initInMemoryAuth(),
	...initInMemoryArticleStore(),
	...initStaticParser(),
});

const app = createApp(createProviders());

export const handler = lambdaExpress({ app });
