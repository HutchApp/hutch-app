import { initInMemoryAuth } from "./providers/auth/in-memory-auth";
import { initInMemoryPasswordReset } from "./providers/auth/in-memory-password-reset";
import { initInMemoryArticleStore } from "./providers/article-store/in-memory-article-store";
import { initReadabilityParser } from "./providers/article-parser/readability-parser";
import type { FetchHtml } from "./providers/article-parser/readability-parser";
import type { EmailMessage, SendEmail } from "./providers/email/email.types";
import {
	createOAuthModel,
	initInMemoryOAuthModel,
} from "./providers/oauth/oauth-model";
import { createValidateAccessToken } from "./providers/oauth/validate-access-token";
import { createApp } from "./server";

function initSpyEmail(): { sendEmail: SendEmail; sentEmails: EmailMessage[] } {
	const sentEmails: EmailMessage[] = [];
	const sendEmail: SendEmail = async (message) => {
		sentEmails.push(message);
	};
	return { sendEmail, sentEmails };
}

const stubFetchHtml: FetchHtml = async (url) => {
	const hostname = new URL(url).hostname;
	return `<html><head><title>Article from ${hostname}</title></head><body><article><p>Content saved from ${hostname}.</p></article></body></html>`;
};

export function createTestApp(options?: {
	livereloadMiddleware?: Parameters<typeof createApp>[0]["livereloadMiddleware"];
}) {
	const auth = initInMemoryAuth();
	const passwordReset = initInMemoryPasswordReset({
		userExists: auth.userExists,
		updatePasswordHash: auth.updatePasswordHash,
	});
	const articleStore = initInMemoryArticleStore();
	const parser = initReadabilityParser({ fetchHtml: stubFetchHtml });
	const oauthModel = createOAuthModel(initInMemoryOAuthModel());
	const email = initSpyEmail();

	const app = createApp({
		...auth,
		...passwordReset,
		...articleStore,
		...parser,
		oauthModel,
		validateAccessToken: createValidateAccessToken(oauthModel),
		sendEmail: email.sendEmail,
		livereloadMiddleware: options?.livereloadMiddleware,
	});

	return { app, auth, passwordReset, articleStore, parser, oauthModel, email };
}

export function createTestAppWithFetchHtml(fetchHtml: FetchHtml) {
	const auth = initInMemoryAuth();
	const passwordReset = initInMemoryPasswordReset({
		userExists: auth.userExists,
		updatePasswordHash: auth.updatePasswordHash,
	});
	const articleStore = initInMemoryArticleStore();
	const parser = initReadabilityParser({ fetchHtml });
	const oauthModel = createOAuthModel(initInMemoryOAuthModel());
	const email = initSpyEmail();

	const app = createApp({
		...auth,
		...passwordReset,
		...articleStore,
		...parser,
		oauthModel,
		validateAccessToken: createValidateAccessToken(oauthModel),
		sendEmail: email.sendEmail,
	});

	return { app, auth, passwordReset, articleStore, parser, oauthModel, email };
}
