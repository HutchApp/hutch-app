import type { Request, Response, Router } from "express";
import express from "express";
import type {
	CountUsers,
	CreateSession,
	CreateUser,
	DestroySession,
	MarkEmailVerified,
	MarkSessionEmailVerified,
	VerifyCredentials,
} from "../../providers/auth/auth.types";
import type { SendEmail } from "../../providers/email/email.types";
import type {
	CreateVerificationToken,
	VerifyEmailToken,
} from "../../providers/email-verification/email-verification.types";
import { VerificationTokenSchema } from "../../providers/email-verification/email-verification.schema";
import { z } from "zod";
import { renderPage } from "../render-page";
import { sendComponent } from "../send-component";
import { LoginSchema, SignupSchema } from "./auth.schema";
import { LoginPage, SignupPage, VerifyEmailPage } from "./auth.component";
import { extractReturnUrl, parseReturnUrl } from "./parse-return-url";
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from "./session-cookie";
import { buildVerificationEmailHtml } from "./verification-email";
import { flattenZodErrors } from "./flatten-zod-errors";
import { initFetchUserCount } from "./fetch-user-count";

const TokenQuerySchema = z.object({ token: z.string().optional() }).passthrough();

const EMAIL_FROM = "Fayner Brack <readplace@readplace.com>";

interface AuthDependencies {
	createUser: CreateUser;
	verifyCredentials: VerifyCredentials;
	createSession: CreateSession;
	destroySession: DestroySession;
	countUsers: CountUsers;
	markEmailVerified: MarkEmailVerified;
	markSessionEmailVerified: MarkSessionEmailVerified;
	sendEmail: SendEmail;
	createVerificationToken: CreateVerificationToken;
	verifyEmailToken: VerifyEmailToken;
	baseUrl: string;
	logError: (message: string, error?: Error) => void;
}

export function initAuthRoutes(deps: AuthDependencies): Router {
	const router = express.Router();

	const fetchUserCount = initFetchUserCount({
		countUsers: deps.countUsers,
		logError: deps.logError,
		logPrefix: "[Auth]",
	});

	router.get("/login", async (req: Request, res: Response) => {
		if (req.userId) {
			res.redirect(303, "/queue");
			return;
		}
		const returnUrl = extractReturnUrl(req.query);
		const userCount = await fetchUserCount();
		sendComponent(res, renderPage(req, LoginPage({ returnUrl, userCount })));
	});

	router.post("/login", async (req: Request, res: Response) => {
		const returnUrl = extractReturnUrl(req.query);
		const parsed = LoginSchema.safeParse(req.body);

		if (!parsed.success) {
			const userCount = await fetchUserCount();
			sendComponent(
				res,
				renderPage(req, LoginPage(
					{
						returnUrl,
						userCount,
						email: req.body?.email,
						errors: flattenZodErrors(parsed.error.issues),
					},
					{ statusCode: 422 },
				)),
			);
			return;
		}

		const { email, password } = parsed.data;
		const credentials = await deps.verifyCredentials({ email, password });

		if (!credentials.ok) {
			const userCount = await fetchUserCount();
			sendComponent(
				res,
				renderPage(req, LoginPage(
					{
						returnUrl,
						userCount,
						email,
						globalError: "Invalid email or password",
					},
					{ statusCode: 422 },
				)),
			);
			return;
		}

		const sessionId = await deps.createSession({ userId: credentials.userId, emailVerified: credentials.emailVerified });
		res.cookie(SESSION_COOKIE_NAME, sessionId, SESSION_COOKIE_OPTIONS);
		res.redirect(303, parseReturnUrl(req.query));
	});

	router.get("/signup", async (req: Request, res: Response) => {
		if (req.userId) {
			res.redirect(303, "/queue");
			return;
		}
		const returnUrl = extractReturnUrl(req.query);
		const userCount = await fetchUserCount();
		sendComponent(res, renderPage(req, SignupPage({ returnUrl, userCount })));
	});

	router.post("/signup", async (req: Request, res: Response) => {
		const returnUrl = extractReturnUrl(req.query);
		const parsed = SignupSchema.safeParse(req.body);

		if (!parsed.success) {
			const userCount = await fetchUserCount();
			sendComponent(
				res,
				renderPage(req, SignupPage(
					{
						returnUrl,
						userCount,
						email: req.body?.email,
						errors: flattenZodErrors(parsed.error.issues),
					},
					{ statusCode: 422 },
				)),
			);
			return;
		}

		const { email, password } = parsed.data;
		const createResult = await deps.createUser({ email, password });

		if (!createResult.ok) {
			const userCount = await fetchUserCount();
			sendComponent(
				res,
				renderPage(req, SignupPage(
					{
						returnUrl,
						userCount,
						email,
						globalError: "An account with this email already exists",
					},
					{ statusCode: 422 },
				)),
			);
			return;
		}

		const sessionId = await deps.createSession({ userId: createResult.userId, emailVerified: false });
		res.cookie(SESSION_COOKIE_NAME, sessionId, SESSION_COOKIE_OPTIONS);
		res.redirect(303, parseReturnUrl(req.query));

		deps.createVerificationToken({ userId: createResult.userId, email })
			.then((token) => {
				const verifyUrl = `${deps.baseUrl}/verify-email?token=${token}`;
				const html = buildVerificationEmailHtml(verifyUrl);
				return deps.sendEmail({
					from: EMAIL_FROM,
					to: email,
					bcc: "readplace+account_verifications@readplace.com",
					subject: "Verify your email — Readplace",
					html,
				});
			})
			.catch((err) => {
				deps.logError("[Email] Verification email failed", err instanceof Error ? err : new Error(String(err)));
			});
	});

	router.get("/verify-email", async (req: Request, res: Response) => {
		const parsed = TokenQuerySchema.safeParse(req.query);
		const token = parsed.success ? (parsed.data.token ?? "") : "";

		if (!token) {
			sendComponent(
				res,
				renderPage(req, VerifyEmailPage({
					success: false,
					error: "No verification token provided.",
				})),
			);
			return;
		}

		const verifyResult = await deps.verifyEmailToken(VerificationTokenSchema.parse(token));

		if (!verifyResult.ok) {
			sendComponent(
				res,
				renderPage(req, VerifyEmailPage({
					success: false,
					error: "This verification link is invalid or has already been used.",
				})),
			);
			return;
		}

		await deps.markEmailVerified(verifyResult.email);

		const sessionId = req.cookies?.[SESSION_COOKIE_NAME];
		if (sessionId) {
			await deps.markSessionEmailVerified(sessionId);
		}

		sendComponent(res, renderPage(req, VerifyEmailPage({ success: true })));
	});

	router.post("/logout", async (req: Request, res: Response) => {
		const sessionId = req.cookies?.[SESSION_COOKIE_NAME];
		if (sessionId) {
			await deps.destroySession(sessionId);
		}
		res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
		res.redirect(303, "/");
	});

	return router;
}
