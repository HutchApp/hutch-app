import type { Express } from "express";
import { initInMemoryAuth } from "./providers/auth/in-memory-auth";
import type { initInMemoryArticleStore } from "./providers/article-store/in-memory-article-store";
import { ArticleResourceUniqueId } from "@packages/article-resource-unique-id";
import type { CrawlArticle } from "@packages/crawl-article";
import { noopLogger } from "@packages/hutch-logger";
import type { ParseArticle } from "./providers/article-parser/article-parser.types";
import type { PublishLinkSaved } from "./providers/events/publish-link-saved.types";
import type { PublishSaveAnonymousLink } from "./providers/events/publish-save-anonymous-link.types";
import type { PublishSaveLinkRawHtmlCommand } from "./providers/events/publish-save-link-raw-html-command.types";
import { initInMemorySaveLinkRawHtmlCommand } from "./providers/events/in-memory-save-link-raw-html-command";
import type { PublishUpdateFetchTimestamp } from "./providers/events/publish-update-fetch-timestamp.types";
import type { PutPendingHtml } from "./providers/pending-html/pending-html.types";
import { initInMemoryPendingHtml } from "./providers/pending-html/in-memory-pending-html";
import type {
	FindGeneratedSummary,
	MarkSummaryPending,
} from "./providers/article-summary/article-summary.types";
import type {
	FindArticleCrawlStatus,
	ForceMarkCrawlPending,
	MarkCrawlPending,
} from "./providers/article-crawl/article-crawl.types";
import type {
	InMemoryMarkCrawlFailed,
	InMemoryMarkCrawlReady,
	initInMemoryArticleCrawl,
} from "./providers/article-crawl/in-memory-article-crawl";
import type { RefreshArticleIfStale } from "./providers/article-freshness/check-content-freshness";
import type {
	CountUsers,
	CreateGoogleUser,
	CreateSession,
	CreateUser,
	DestroySession,
	FindUserByEmail,
	GetSessionUserId,
	MarkEmailVerified,
	MarkSessionEmailVerified,
	UpdatePassword,
	UserExistsByEmail,
	VerifyCredentials,
} from "./providers/auth/auth.types";
import type {
	ArticleMetadata,
	Minutes,
} from "./domain/article/article.types";
import type {
	DeleteArticle,
	FindArticleById,
	FindArticleByUrl,
	FindArticlesByUser,
	SaveArticle,
	SaveArticleGlobally,
	UpdateArticleStatus,
} from "./providers/article-store/article-store.types";
import type {
	ContentProvider,
	ReadArticleContent,
} from "./providers/article-store/read-article-content";
import type { SendEmail, EmailMessage } from "./providers/email/email.types";
import { initInMemoryEmail } from "./providers/email/in-memory-email";
import type {
	CreateVerificationToken,
	VerifyEmailToken,
} from "./providers/email-verification/email-verification.types";
import { initInMemoryEmailVerification } from "./providers/email-verification/in-memory-email-verification";
import type {
	CreatePasswordResetToken,
	VerifyPasswordResetToken,
} from "./providers/password-reset/password-reset.types";
import { initInMemoryPasswordReset } from "./providers/password-reset/in-memory-password-reset";
import type { ExchangeGoogleCode } from "./providers/google-auth/google-token.types";
import {
	createOAuthModel,
	initInMemoryOAuthModel,
	type OAuthModel,
} from "./providers/oauth/oauth-model";
import { createValidateAccessToken } from "./providers/oauth/validate-access-token";
import type { ValidateAccessToken } from "./web/dual-auth.middleware";
import { createApp } from "./server";
import type { HttpErrorMessageMapping } from "./web/pages/queue/queue.error";

export interface AuthBundle {
	createUser: CreateUser;
	createGoogleUser: CreateGoogleUser;
	findUserByEmail: FindUserByEmail;
	verifyCredentials: VerifyCredentials;
	createSession: CreateSession;
	getSessionUserId: GetSessionUserId;
	destroySession: DestroySession;
	countUsers: CountUsers;
	markEmailVerified: MarkEmailVerified;
	markSessionEmailVerified: MarkSessionEmailVerified;
	userExistsByEmail: UserExistsByEmail;
	updatePassword: UpdatePassword;
}

export interface ArticleStoreBundle {
	findArticleById: FindArticleById;
	findArticleByUrl: FindArticleByUrl;
	findArticlesByUser: FindArticlesByUser;
	saveArticle: SaveArticle;
	saveArticleGlobally: SaveArticleGlobally;
	deleteArticle: DeleteArticle;
	updateArticleStatus: UpdateArticleStatus;
	readArticleContent: ReadArticleContent;
	readContent: ContentProvider;
	writeContent: (params: { url: string; content: string }) => Promise<void>;
	writeMetadata: (params: {
		url: string;
		metadata: ArticleMetadata;
		estimatedReadTime: Minutes;
	}) => Promise<void>;
}

export interface ArticleCrawlBundle {
	findArticleCrawlStatus: FindArticleCrawlStatus;
	markCrawlPending: MarkCrawlPending;
	forceMarkCrawlPending: ForceMarkCrawlPending;
	markCrawlReady: InMemoryMarkCrawlReady;
	markCrawlFailed: InMemoryMarkCrawlFailed;
}

export interface ParserBundle {
	parseArticle: ParseArticle;
	crawlArticle: CrawlArticle;
}

export interface EventsBundle {
	publishLinkSaved: PublishLinkSaved;
	publishSaveAnonymousLink: PublishSaveAnonymousLink;
	publishSaveLinkRawHtmlCommand: PublishSaveLinkRawHtmlCommand;
	publishUpdateFetchTimestamp: PublishUpdateFetchTimestamp;
}

export interface PendingHtmlBundle {
	putPendingHtml: PutPendingHtml;
}

export interface SummaryBundle {
	findGeneratedSummary: FindGeneratedSummary;
	markSummaryPending: MarkSummaryPending;
}

export interface FreshnessBundle {
	refreshArticleIfStale: RefreshArticleIfStale;
}

export interface OAuthBundle {
	oauthModel: OAuthModel;
	validateAccessToken: ValidateAccessToken;
}

export interface EmailBundle {
	sendEmail: SendEmail;
	getSentEmails: () => EmailMessage[];
}

export interface EmailVerificationBundle {
	createVerificationToken: CreateVerificationToken;
	verifyEmailToken: VerifyEmailToken;
}

export interface PasswordResetBundle {
	createPasswordResetToken: CreatePasswordResetToken;
	verifyPasswordResetToken: VerifyPasswordResetToken;
}

export interface GoogleAuthBundle {
	exchangeGoogleCode: ExchangeGoogleCode;
	clientId: string;
	clientSecret: string;
}

export interface AdminBundle {
	adminEmails: readonly string[];
	recrawlServiceToken: string;
}

export interface SharedBundle {
	appOrigin: string;
	httpErrorMessageMapping: HttpErrorMessageMapping;
	logError: (message: string, error?: Error) => void;
}

export interface TestAppFixture {
	auth: AuthBundle;
	articleStore: ArticleStoreBundle;
	articleCrawl: ArticleCrawlBundle;
	parser: ParserBundle;
	events: EventsBundle;
	pendingHtml: PendingHtmlBundle;
	summary: SummaryBundle;
	freshness: FreshnessBundle;
	oauth: OAuthBundle;
	email: EmailBundle;
	emailVerification: EmailVerificationBundle;
	passwordReset: PasswordResetBundle;
	google: GoogleAuthBundle | undefined;
	admin: AdminBundle;
	shared: SharedBundle;
}

export interface TestAppResult {
	app: Express;
	auth: AuthBundle;
	articleStore: ArticleStoreBundle;
	articleCrawl: ArticleCrawlBundle;
	oauthModel: OAuthModel;
	email: EmailBundle;
	emailVerification: EmailVerificationBundle;
	passwordReset: PasswordResetBundle;
}

function flattenFixtureToAppDependencies(
	fixture: TestAppFixture,
): Parameters<typeof createApp>[0] {
	return {
		appOrigin: fixture.shared.appOrigin,
		staticBaseUrl: "",
		baseUrl: fixture.shared.appOrigin,
		logError: fixture.shared.logError,
		httpErrorMessageMapping: fixture.shared.httpErrorMessageMapping,
		createUser: fixture.auth.createUser,
		createGoogleUser: fixture.auth.createGoogleUser,
		findUserByEmail: fixture.auth.findUserByEmail,
		verifyCredentials: fixture.auth.verifyCredentials,
		createSession: fixture.auth.createSession,
		getSessionUserId: fixture.auth.getSessionUserId,
		destroySession: fixture.auth.destroySession,
		countUsers: fixture.auth.countUsers,
		markEmailVerified: fixture.auth.markEmailVerified,
		markSessionEmailVerified: fixture.auth.markSessionEmailVerified,
		userExistsByEmail: fixture.auth.userExistsByEmail,
		updatePassword: fixture.auth.updatePassword,
		findArticleById: fixture.articleStore.findArticleById,
		findArticleByUrl: fixture.articleStore.findArticleByUrl,
		findArticlesByUser: fixture.articleStore.findArticlesByUser,
		saveArticle: fixture.articleStore.saveArticle,
		saveArticleGlobally: fixture.articleStore.saveArticleGlobally,
		deleteArticle: fixture.articleStore.deleteArticle,
		updateArticleStatus: fixture.articleStore.updateArticleStatus,
		readArticleContent: fixture.articleStore.readArticleContent,
		findArticleCrawlStatus: fixture.articleCrawl.findArticleCrawlStatus,
		markCrawlPending: fixture.articleCrawl.markCrawlPending,
		forceMarkCrawlPending: fixture.articleCrawl.forceMarkCrawlPending,
		publishLinkSaved: fixture.events.publishLinkSaved,
		publishSaveAnonymousLink: fixture.events.publishSaveAnonymousLink,
		publishSaveLinkRawHtmlCommand: fixture.events.publishSaveLinkRawHtmlCommand,
		publishUpdateFetchTimestamp: fixture.events.publishUpdateFetchTimestamp,
		putPendingHtml: fixture.pendingHtml.putPendingHtml,
		findGeneratedSummary: fixture.summary.findGeneratedSummary,
		markSummaryPending: fixture.summary.markSummaryPending,
		refreshArticleIfStale: fixture.freshness.refreshArticleIfStale,
		oauthModel: fixture.oauth.oauthModel,
		validateAccessToken: fixture.oauth.validateAccessToken,
		sendEmail: fixture.email.sendEmail,
		createVerificationToken: fixture.emailVerification.createVerificationToken,
		verifyEmailToken: fixture.emailVerification.verifyEmailToken,
		createPasswordResetToken: fixture.passwordReset.createPasswordResetToken,
		verifyPasswordResetToken: fixture.passwordReset.verifyPasswordResetToken,
		googleAuth: fixture.google,
		adminEmails: fixture.admin.adminEmails,
		recrawlServiceToken: fixture.admin.recrawlServiceToken,
	};
}

export function createTestAppFromFixture(fixture: TestAppFixture): TestAppResult {
	const app = createApp(flattenFixtureToAppDependencies(fixture));
	return {
		app,
		auth: fixture.auth,
		articleStore: fixture.articleStore,
		articleCrawl: fixture.articleCrawl,
		oauthModel: fixture.oauth.oauthModel,
		email: fixture.email,
		emailVerification: fixture.emailVerification,
		passwordReset: fixture.passwordReset,
	};
}

export function createTestApp(options: {
	articleStore: ReturnType<typeof initInMemoryArticleStore>;
	articleCrawl: ReturnType<typeof initInMemoryArticleCrawl>;
	parseArticle: ParseArticle;
	crawlArticle: CrawlArticle;
	publishLinkSaved: PublishLinkSaved;
	publishSaveAnonymousLink: PublishSaveAnonymousLink;
	publishSaveLinkRawHtmlCommand?: PublishSaveLinkRawHtmlCommand;
	publishUpdateFetchTimestamp: PublishUpdateFetchTimestamp;
	putPendingHtml?: PutPendingHtml;
	findGeneratedSummary: FindGeneratedSummary;
	markSummaryPending: MarkSummaryPending;
	findArticleCrawlStatus: FindArticleCrawlStatus;
	markCrawlPending: MarkCrawlPending;
	forceMarkCrawlPending: ForceMarkCrawlPending;
	refreshArticleIfStale: RefreshArticleIfStale;
	httpErrorMessageMapping: HttpErrorMessageMapping;
	exchangeGoogleCode: ExchangeGoogleCode | undefined;
	logError: (message: string, error?: Error) => void;
	appOrigin: string;
	adminEmails: readonly string[];
	recrawlServiceToken: string;
}) {
	const auth = initInMemoryAuth();
	const oauthModel = createOAuthModel(initInMemoryOAuthModel(), { appOrigin: options.appOrigin });
	const email = initInMemoryEmail();
	const emailVerification = initInMemoryEmailVerification();
	const passwordReset = initInMemoryPasswordReset();

	const publishSaveLinkRawHtmlCommand =
		options.publishSaveLinkRawHtmlCommand
		?? initInMemorySaveLinkRawHtmlCommand({ logger: noopLogger }).publishSaveLinkRawHtmlCommand;
	const putPendingHtml = options.putPendingHtml ?? initInMemoryPendingHtml().putPendingHtml;

	const app = createApp({
		appOrigin: options.appOrigin,
		staticBaseUrl: "",
		...auth,
		...options.articleStore,
		readArticleContent: (url) =>
			options.articleStore.readContent(ArticleResourceUniqueId.parse(url)),
		publishLinkSaved: options.publishLinkSaved,
		publishSaveAnonymousLink: options.publishSaveAnonymousLink,
		publishSaveLinkRawHtmlCommand,
		publishUpdateFetchTimestamp: options.publishUpdateFetchTimestamp,
		putPendingHtml,
		findGeneratedSummary: options.findGeneratedSummary,
		markSummaryPending: options.markSummaryPending,
		findArticleCrawlStatus: options.findArticleCrawlStatus,
		markCrawlPending: options.markCrawlPending,
		forceMarkCrawlPending: options.forceMarkCrawlPending,
		adminEmails: options.adminEmails,
		recrawlServiceToken: options.recrawlServiceToken,
		refreshArticleIfStale: options.refreshArticleIfStale,
		httpErrorMessageMapping: options.httpErrorMessageMapping,
		...email,
		...emailVerification,
		...passwordReset,
		googleAuth: options.exchangeGoogleCode
			? {
				exchangeGoogleCode: options.exchangeGoogleCode,
				clientId: "test-google-client-id",
				clientSecret: "test-google-client-secret",
			}
			: undefined,
		baseUrl: options.appOrigin,
		logError: options.logError,
		oauthModel,
		validateAccessToken: createValidateAccessToken(oauthModel),
	});

	return {
		app,
		auth,
		articleStore: options.articleStore,
		articleCrawl: options.articleCrawl,
		oauthModel,
		email,
		emailVerification,
		passwordReset,
	};
}
