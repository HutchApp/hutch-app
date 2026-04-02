import cookieParser from "cookie-parser";
import cors from "cors";
import type { Express, NextFunction, Request, Response } from "express";
import express from "express";
import type {
	CountUsers,
	CreateSession,
	CreateUser,
	DestroySession,
	GetSessionUserId,
	MarkEmailVerified,
	MarkSessionEmailVerified,
	VerifyCredentials,
} from "./providers/auth/auth.types";
import type { ParseArticle } from "./providers/article-parser/article-parser.types";
import type {
	DeleteArticle,
	FindArticleById,
	FindArticlesByUser,
	SaveArticle,
	UpdateArticleFetchMetadata,
	UpdateArticleStatus,
} from "./providers/article-store/article-store.types";
import type { RefreshArticleIfStale } from "./providers/article-freshness/check-content-freshness";
import type { FindCachedSummary } from "./providers/article-summary/article-summary.types";
import type { PublishLinkSaved } from "./providers/events/publish-link-saved.types";
import type { SendEmail } from "./providers/email/email.types";
import type {
	CreateVerificationToken,
	VerifyEmailToken,
} from "./providers/email-verification/email-verification.types";
import type { OAuthModel } from "./providers/oauth/oauth-model";
import type { ExchangeGmailCode, ListUnreadGmailMessages } from "./providers/gmail/gmail-api.types";
import type { FindGmailTokens, SaveGmailTokens, DeleteGmailTokens } from "./providers/gmail/gmail-token-store.types";
import type { EnsureValidAccessToken } from "./providers/gmail/ensure-valid-access-token";
import type { RunGmailImport } from "./domain/gmail-import/gmail-import.types";
import { initAuthRoutes } from "./web/auth/auth.page";
import { initQueueRoutes } from "./web/pages/queue/queue.page";
import { initExportRoutes } from "./web/pages/export/export.page";
import { initGmailImportRoutes } from "./web/pages/gmail-import/gmail-import.page";
import { initDualAuth, type ValidateAccessToken } from "./web/dual-auth.middleware";
import { initOAuthRoutes } from "./web/oauth/oauth.routes";
import { HomePage } from "./web/pages/home";
import { PrivacyPage } from "./web/pages/privacy";
import { TermsPage } from "./web/pages/terms";
import { InstallPage, fetchFirefoxDownloadUrl, fetchChromeDownloadUrl } from "./web/pages/install";
import { NotFoundPage } from "./web/pages/not-found";
import { requireEnv } from "./require-env";
import "./web/session.types";

export const PORT = requireEnv("PORT", { defaultValue: "3000" });

const COOKIE_NAME = "hutch_sid";

interface AppDependencies {
	appOrigin: string;
	staticBaseUrl: string;
	createUser: CreateUser;
	verifyCredentials: VerifyCredentials;
	createSession: CreateSession;
	getSessionUserId: GetSessionUserId;
	destroySession: DestroySession;
	countUsers: CountUsers;
	markEmailVerified: MarkEmailVerified;
	markSessionEmailVerified: MarkSessionEmailVerified;
	parseArticle: ParseArticle;
	findArticleById: FindArticleById;
	findArticlesByUser: FindArticlesByUser;
	saveArticle: SaveArticle;
	deleteArticle: DeleteArticle;
	updateArticleStatus: UpdateArticleStatus;
	sendEmail: SendEmail;
	createVerificationToken: CreateVerificationToken;
	verifyEmailToken: VerifyEmailToken;
	baseUrl: string;
	logError: (message: string, error?: Error) => void;
	oauthModel: OAuthModel;
	validateAccessToken: ValidateAccessToken;
	publishLinkSaved: PublishLinkSaved;
	findCachedSummary: FindCachedSummary;
	refreshArticleIfStale: RefreshArticleIfStale;
	updateArticleFetchMetadata: UpdateArticleFetchMetadata;
	findGmailTokens: FindGmailTokens;
	saveGmailTokens: SaveGmailTokens;
	deleteGmailTokens: DeleteGmailTokens;
	exchangeGmailCode: ExchangeGmailCode;
	listUnreadGmailMessages: ListUnreadGmailMessages;
	runGmailImport: RunGmailImport;
	ensureValidAccessToken: EnsureValidAccessToken;
	googleClientId: string;
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
	if (!req.userId) {
		res.redirect(303, "/login");
		return;
	}
	next();
}

export function createApp(dependencies: AppDependencies): Express {
	const { appOrigin, staticBaseUrl, getSessionUserId, countUsers, ...deps } = dependencies;
	const app: Express = express();

	app.use(express.urlencoded({ extended: true }));
	app.use(express.json());
	app.use(cookieParser());

	app.use(async (req: Request, _res: Response, next: NextFunction) => {
		const sessionId = req.cookies?.[COOKIE_NAME];
		if (sessionId) {
			const session = await getSessionUserId(sessionId);
			if (session) {
				req.userId = session.userId;
				req.emailVerified = session.emailVerified;
			}
		}
		next();
	});

	app.get("/robots.txt", (_req: Request, res: Response) => {
		res.type("text/plain").send(
			[
				"User-agent: *",
				"Allow: /",
				"Disallow: /queue",
				"Disallow: /export",
				"Disallow: /oauth",
				"Disallow: /gmail-import",
				"Disallow: /forgot-password",
				"",
				`Sitemap: ${dependencies.baseUrl}/sitemap.xml`,
			].join("\n"),
		);
	});

	app.get("/sitemap.xml", (_req: Request, res: Response) => {
		const pages = [
			{ loc: "/", priority: "1.0", changefreq: "weekly" },
			{ loc: "/install", priority: "0.8", changefreq: "monthly" },
			{ loc: "/login", priority: "0.5", changefreq: "yearly" },
			{ loc: "/signup", priority: "0.5", changefreq: "yearly" },
			{ loc: "/privacy", priority: "0.3", changefreq: "yearly" },
			{ loc: "/terms", priority: "0.3", changefreq: "yearly" },
		];
		const urls = pages
			.map(
				(p) =>
					`  <url>\n    <loc>${dependencies.baseUrl}${p.loc}</loc>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`,
			)
			.join("\n");
		res.type("application/xml").send(
			`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`,
		);
	});

	app.get("/", async (req: Request, res: Response) => {
		const ua = req.headers["user-agent"] ?? "";
		const browser: "firefox" | "chrome" | "other" =
			ua.includes("Firefox/") ? "firefox"
			: ua.includes("Chrome/") ? "chrome"
			: "other";
		const userCount = await countUsers().catch(() => 0);
		const result = HomePage({ userCount, staticBaseUrl, browser }).to("text/html");
		res.status(result.statusCode).type("html").send(result.body);
	});

	app.get("/privacy", (_req: Request, res: Response) => {
		const result = PrivacyPage().to("text/html");
		res.status(result.statusCode).type("html").send(result.body);
	});

	app.get("/terms", (_req: Request, res: Response) => {
		const result = TermsPage().to("text/html");
		res.status(result.statusCode).type("html").send(result.body);
	});

	app.get("/install", async (req: Request, res: Response) => {
		const browser = req.query.browser === "firefox" ? "firefox" : "chrome";
		const [firefox, chrome] = await Promise.all([
			fetchFirefoxDownloadUrl(),
			fetchChromeDownloadUrl(),
		]);
		const result = InstallPage({ firefox, chrome, browser }).to("text/html");
		res.status(result.statusCode).type("html").send(result.body);
	});

	const authRouter = initAuthRoutes({
		createUser: deps.createUser,
		verifyCredentials: deps.verifyCredentials,
		createSession: deps.createSession,
		destroySession: deps.destroySession,
		markEmailVerified: deps.markEmailVerified,
		markSessionEmailVerified: deps.markSessionEmailVerified,
		sendEmail: deps.sendEmail,
		createVerificationToken: deps.createVerificationToken,
		verifyEmailToken: deps.verifyEmailToken,
		baseUrl: deps.baseUrl,
		logError: deps.logError,
	});
	app.use(authRouter);

	const extensionCors = cors({
		origin: (origin, callback) => {
			if (!origin || origin === appOrigin || /^(moz|chrome)-extension:\/\//.test(origin)) {
				callback(null, true);
			} else {
				callback(null, false);
			}
		},
		methods: ["GET", "POST", "PUT", "DELETE"],
		allowedHeaders: ["Authorization", "Content-Type", "Accept"],
		maxAge: 86400,
	});

	const dualAuthMiddleware = initDualAuth({
		validateAccessToken: deps.validateAccessToken,
	});

	const queueRouter = initQueueRoutes({
		findArticlesByUser: deps.findArticlesByUser,
		findArticleById: deps.findArticleById,
		saveArticle: deps.saveArticle,
		parseArticle: deps.parseArticle,
		deleteArticle: deps.deleteArticle,
		updateArticleStatus: deps.updateArticleStatus,
		publishLinkSaved: deps.publishLinkSaved,
		findCachedSummary: deps.findCachedSummary,
		refreshArticleIfStale: deps.refreshArticleIfStale,
		updateArticleFetchMetadata: deps.updateArticleFetchMetadata,
		logError: deps.logError,
	});
	app.use("/queue", extensionCors, dualAuthMiddleware, queueRouter);

	const exportRouter = initExportRoutes({
		findArticlesByUser: deps.findArticlesByUser,
	});
	app.use("/export", requireAuth, exportRouter);

	const gmailImportRouter = initGmailImportRoutes({
		findGmailTokens: deps.findGmailTokens,
		saveGmailTokens: deps.saveGmailTokens,
		deleteGmailTokens: deps.deleteGmailTokens,
		exchangeGmailCode: deps.exchangeGmailCode,
		ensureValidAccessToken: deps.ensureValidAccessToken,
		listUnreadGmailMessages: deps.listUnreadGmailMessages,
		runGmailImport: deps.runGmailImport,
		googleClientId: deps.googleClientId,
		appOrigin,
		logError: deps.logError,
	});
	app.use("/gmail-import", requireAuth, gmailImportRouter);

	const oauthRouter = initOAuthRoutes({
		model: deps.oauthModel,
	});
	app.use("/oauth/token", extensionCors);
	app.use("/oauth/revoke", extensionCors);
	app.use("/oauth", oauthRouter);

	app.use((_req: Request, res: Response) => {
		const result = NotFoundPage().to("text/html");
		res.status(404).type("html").send(result.body);
	});

	return app;
}
