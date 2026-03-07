import { join } from "node:path";
import cookieParser from "cookie-parser";
import { config } from "dotenv";
import type { Express, NextFunction, Request, Response } from "express";
import express from "express";
import type {
	CreateSession,
	CreateUser,
	DestroySession,
	GetSessionUserId,
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
import type { OAuthModel } from "./providers/oauth/oauth-model";
import { initAuthRoutes } from "./web/auth/auth.page";
import { initQueueRoutes } from "./web/pages/queue/queue.page";
import { initExportRoutes } from "./web/pages/export/export.page";
import { initOAuthRoutes } from "./web/oauth/oauth.routes";
import { LandingPage } from "./web/pages/landing";
import { PrivacyPage } from "./web/pages/privacy";
import { TermsPage } from "./web/pages/terms";
import { InstallPage } from "./web/pages/install";
import { render } from "./web/render";
import { requireEnv } from "./require-env";
import "./web/session.types";

config({ path: join(__dirname, "../../.env") });

export const PORT = requireEnv("PORT", "3000");

const COOKIE_NAME = "hutch_sid";

interface AppDependencies {
	livereloadMiddleware?: ReturnType<typeof import("connect-livereload")>;
	createUser: CreateUser;
	verifyCredentials: VerifyCredentials;
	createSession: CreateSession;
	getSessionUserId: GetSessionUserId;
	destroySession: DestroySession;
	parseArticle: ParseArticle;
	findArticleById: FindArticleById;
	findArticlesByUser: FindArticlesByUser;
	saveArticle: SaveArticle;
	deleteArticle: DeleteArticle;
	updateArticleStatus: UpdateArticleStatus;
	oauthModel: OAuthModel;
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
	if (!req.userId) {
		res.redirect(303, "/login");
		return;
	}
	next();
}

export function createApp(dependencies: AppDependencies): Express {
	const { livereloadMiddleware, getSessionUserId, ...deps } = dependencies;
	const app: Express = express();

	if (livereloadMiddleware) {
		app.use(livereloadMiddleware);
	}

	app.use(express.static(join(__dirname, "public")));
	app.use(express.urlencoded({ extended: true }));
	app.use(express.json());
	app.use(cookieParser());

	app.use(async (req: Request, _res: Response, next: NextFunction) => {
		const sessionId = req.cookies?.[COOKIE_NAME];
		if (sessionId) {
			const userId = await getSessionUserId(sessionId);
			if (userId) {
				req.userId = userId;
			}
		}
		next();
	});

	app.get("/", (_req: Request, res: Response) => {
		const result = LandingPage().to("text/html");
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

	app.get("/install", (_req: Request, res: Response) => {
		const result = InstallPage().to("text/html");
		res.status(result.statusCode).type("html").send(result.body);
	});

	const authRouter = initAuthRoutes({
		createUser: deps.createUser,
		verifyCredentials: deps.verifyCredentials,
		createSession: deps.createSession,
		destroySession: deps.destroySession,
	});
	app.use(authRouter);

	const queueRouter = initQueueRoutes({
		findArticlesByUser: deps.findArticlesByUser,
		findArticleById: deps.findArticleById,
		saveArticle: deps.saveArticle,
		parseArticle: deps.parseArticle,
		deleteArticle: deps.deleteArticle,
		updateArticleStatus: deps.updateArticleStatus,
	});
	app.use("/queue", requireAuth, queueRouter);

	const exportRouter = initExportRoutes({
		findArticlesByUser: deps.findArticlesByUser,
	});
	app.use("/export", requireAuth, exportRouter);

	const oauthRouter = initOAuthRoutes({
		model: deps.oauthModel,
	});
	app.use("/oauth", oauthRouter);

	const NOT_FOUND_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>404 - Not Found</title>
</head>
<body>
  <h1>404 - Page Not Found</h1>
</body>
</html>`;

	app.use((_req: Request, res: Response) => {
		res.status(404).type("html").send(render(NOT_FOUND_TEMPLATE, {}));
	});

	return app;
}
