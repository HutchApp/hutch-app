import { initInMemoryAuth } from "../providers/auth/in-memory-auth";
import { initInMemoryArticleStore } from "../providers/article-store/in-memory-article-store";
import { initStaticParser } from "../providers/article-parser/static-parser";
import { createApp } from "../server";
import { lambdaExpress } from "./lambda-express";

// Provider factory for swapping implementations (e.g., DynamoDB, PostgreSQL)
const createProviders = () => ({
	...initInMemoryAuth(),
	...initInMemoryArticleStore(),
	...initStaticParser(),
});

const app = createApp(createProviders());

export const handler = lambdaExpress({ app });
