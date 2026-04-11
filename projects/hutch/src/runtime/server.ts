import { readFileSync } from "node:fs";
import { join } from "node:path";
import cookieParser from "cookie-parser";
import cors from "cors";
import type { Express, NextFunction, Request, Response } from "express";
import express from "express";
import type {
	CountUsers,
	CreateGoogleUser,
	CreateSession,
	CreateUser,
	DestroySession,
	GetSessionUserId,
	MarkEmailVerified,
	MarkSessionEmailVerified,
	UpdatePassword,
	UserExistsByEmail,
	VerifyCredentials,
} from "./providers/auth/auth.types";
import type { ParseArticle } from "./providers/article-parser/article-parser.types";
import type {
	DeleteArticle,
	FindArticleById,
	FindArticlesByUser,
	SaveArticle,
	UpdateArticleStatus,
} from "./providers/article-store/article-store.types";
import type { PublishUpdateFetchTimestamp } from "./providers/events/publish-update-fetch-timestamp.types";
import type { ReadArticleContent } from "./providers/article-store/read-article-content";
import type { RefreshArticleIfStale } from "./providers/article-freshness/check-content-freshness";
import type { FindCachedSummary } from "./providers/article-summary/article-summary.types";
import type { PublishLinkSaved } from "./providers/events/publish-link-saved.types";
import type { SendEmail } from "./providers/email/email.types";
import type {
	CreateVerificationToken,
	VerifyEmailToken,
} from "./providers/email-verification/email-verification.types";
import type {
	CreatePasswordResetToken,
	VerifyPasswordResetToken,
} from "./providers/password-reset/password-reset.types";
import type { FindUserByGoogleId, LinkGoogleAccount, UnlinkGoogleAccount } from "./providers/google-auth/google-auth.schema";
import type { ExchangeGoogleCode } from "./providers/google-auth/google-token.types";
import type { OAuthModel } from "./providers/oauth/oauth-model";
import { initAuthRoutes } from "./web/auth/auth.page";
import { initGoogleAuthRoutes } from "./web/auth/google-auth.page";
import { initForgotPasswordRoutes } from "./web/auth/forgot-password.page";
import { initQueueRoutes } from "./web/pages/queue/queue.page";
import type { HttpErrorMessageMapping } from "./web/pages/queue/queue.error";
import { initSaveRoutes } from "./web/pages/save/save.page";
import { initExportRoutes } from "./web/pages/export/export.page";
import { initBlogRoutes } from "./web/pages/blog";
import { getAllPostMetadata } from "./web/pages/blog/blog.posts";
import { initDualAuth, type ValidateAccessToken } from "./web/dual-auth.middleware";
import { initOAuthRoutes } from "./web/oauth/oauth.routes";
import { HomePage } from "./web/pages/home";
import { PrivacyPage } from "./web/pages/privacy";
import { TermsPage } from "./web/pages/terms";
import { InstallPage, fetchFirefoxDownloadUrl, fetchChromeDownloadUrl } from "./web/pages/install";
import { NotFoundPage } from "./web/pages/not-found";
import { requireEnv, getEnv } from "./require-env";
import "./web/session.types";

export const PORT = requireEnv("PORT", { defaultValue: "3000" });

const COOKIE_NAME = "hutch_sid";

interface AppDependencies {
	appOrigin: string;
	staticBaseUrl: string;
	createUser: CreateUser;
	createGoogleUser: CreateGoogleUser;
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
	createPasswordResetToken: CreatePasswordResetToken;
	verifyPasswordResetToken: VerifyPasswordResetToken;
	userExistsByEmail: UserExistsByEmail;
	updatePassword: UpdatePassword;
	findUserByGoogleId: FindUserByGoogleId;
	linkGoogleAccount: LinkGoogleAccount;
	unlinkGoogleAccount: UnlinkGoogleAccount;
	exchangeGoogleCode?: ExchangeGoogleCode;
	googleClientId?: string;
	googleClientSecret?: string;
	baseUrl: string;
	logError: (message: string, error?: Error) => void;
	oauthModel: OAuthModel;
	validateAccessToken: ValidateAccessToken;
	publishLinkSaved: PublishLinkSaved;
	findCachedSummary: FindCachedSummary;
	refreshArticleIfStale: RefreshArticleIfStale;
	publishUpdateFetchTimestamp: PublishUpdateFetchTimestamp;
	readArticleContent: ReadArticleContent;
	httpErrorMessageMapping: HttpErrorMessageMapping;
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
	if (!req.userId) {
		res.redirect(303, "/login");
		return;
	}
	next();
}

const LLMS_TXT = readFileSync(join(__dirname, "llms.txt"), "utf-8");
const LLMS_FULL_TXT = readFileSync(join(__dirname, "llms-full.txt"), "utf-8");
const INDEXNOW_KEY = getEnv("INDEXNOW_KEY");

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
				"Disallow: /forgot-password",
				"",
				"User-agent: GPTBot",
				"Allow: /",
				"",
				"User-agent: PerplexityBot",
				"Allow: /",
				"",
				"User-agent: ClaudeBot",
				"Allow: /",
				"",
				"User-agent: Googlebot",
				"Allow: /",
				"",
				`Sitemap: ${dependencies.baseUrl}/sitemap.xml`,
			].join("\n"),
		);
	});

	app.get("/llms.txt", (_req: Request, res: Response) => {
		res.type("text/plain").send(LLMS_TXT);
	});

	app.get("/llms-full.txt", (_req: Request, res: Response) => {
		res.type("text/plain").send(LLMS_FULL_TXT);
	});

	if (INDEXNOW_KEY) {
		app.get(`/${INDEXNOW_KEY}.txt`, (_req: Request, res: Response) => {
			res.type("text/plain").send(INDEXNOW_KEY);
		});
	}

	app.get("/sitemap.xml", (_req: Request, res: Response) => {
		const blogPriorityMap: Record<string, string> = {
			"best-read-it-later-apps-2026": "0.9",
			"omnivore-alternative": "0.9",
			"hutch-vs-readwise-reader": "0.8",
			"hutch-vs-instapaper": "0.8",
			"how-ai-tldr-actually-works": "0.8",
			"free-read-it-later-apps-2026": "0.8",
		};

		const pages: { loc: string; priority: string; changefreq: string; lastmod: string }[] = [
			{ loc: "/", priority: "1.0", changefreq: "weekly", lastmod: "2026-04-08" },
			{ loc: "/blog", priority: "0.8", changefreq: "weekly", lastmod: "2026-04-07" },
			{ loc: "/install", priority: "0.8", changefreq: "monthly", lastmod: "2026-03-01" },
			{ loc: "/login", priority: "0.5", changefreq: "yearly", lastmod: "2026-03-01" },
			{ loc: "/signup", priority: "0.5", changefreq: "yearly", lastmod: "2026-03-01" },
			{ loc: "/privacy", priority: "0.3", changefreq: "yearly", lastmod: "2026-03-01" },
			{ loc: "/terms", priority: "0.3", changefreq: "yearly", lastmod: "2026-03-01" },
			{ loc: "/llms.txt", priority: "0.3", changefreq: "monthly", lastmod: "2026-04-08" },
			{ loc: "/llms-full.txt", priority: "0.3", changefreq: "monthly", lastmod: "2026-04-08" },
		];

		for (const post of getAllPostMetadata()) {
			pages.push({
				loc: `/blog/${post.slug}`,
				priority: blogPriorityMap[post.slug] ?? "0.7",
				changefreq: "weekly",
				lastmod: post.date,
			});
		}
		const urls = pages
			.map(
				(p) =>
					`  <url>\n    <loc>${dependencies.baseUrl}${p.loc}</loc>\n    <lastmod>${p.lastmod}</lastmod>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`,
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

	const blogRouter = initBlogRoutes();
	app.use("/blog", blogRouter);

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

	if (deps.exchangeGoogleCode && deps.googleClientId && deps.googleClientSecret) {
		const googleAuthRouter = initGoogleAuthRoutes({
			googleClientId: deps.googleClientId,
			googleClientSecret: deps.googleClientSecret,
			appOrigin,
			createSession: deps.createSession,
			createGoogleUser: deps.createGoogleUser,
			findUserByGoogleId: deps.findUserByGoogleId,
			linkGoogleAccount: deps.linkGoogleAccount,
			unlinkGoogleAccount: deps.unlinkGoogleAccount,
			exchangeGoogleCode: deps.exchangeGoogleCode,
			logError: deps.logError,
		});
		app.use(googleAuthRouter);
	}

	const forgotPasswordRouter = initForgotPasswordRoutes({
		sendEmail: deps.sendEmail,
		userExistsByEmail: deps.userExistsByEmail,
		updatePassword: deps.updatePassword,
		createPasswordResetToken: deps.createPasswordResetToken,
		verifyPasswordResetToken: deps.verifyPasswordResetToken,
		baseUrl: deps.baseUrl,
		logError: deps.logError,
	});
	app.use(forgotPasswordRouter);

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
		publishUpdateFetchTimestamp: deps.publishUpdateFetchTimestamp,
		readArticleContent: deps.readArticleContent,
		httpErrorMessageMapping: deps.httpErrorMessageMapping,
		logError: deps.logError,
	});
	app.use("/queue", extensionCors, dualAuthMiddleware, queueRouter);

	const saveRouter = initSaveRoutes();
	app.use("/save", saveRouter);

	const exportRouter = initExportRoutes({
		findArticlesByUser: deps.findArticlesByUser,
	});
	app.use("/export", requireAuth, exportRouter);

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
