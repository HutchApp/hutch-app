import type { APIGatewayProxyEvent, Context } from "aws-lambda";
import serverless from "serverless-http";
import { initInMemoryAuth } from "../providers/auth/in-memory-auth";
import { initInMemoryArticleStore } from "../providers/article-store/in-memory-article-store";
import { initStaticParser } from "../providers/article-parser/static-parser";
import { createApp } from "../server";

const auth = initInMemoryAuth();
const articleStore = initInMemoryArticleStore();
const parser = initStaticParser();

const app = createApp({
	...auth,
	...articleStore,
	...parser,
});

const serverlessHandler = serverless(app);

export const handler = async (
	event: APIGatewayProxyEvent,
	context: Context,
) => {
	return serverlessHandler(event, context);
};
