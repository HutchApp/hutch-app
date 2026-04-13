import type { Request, Response, Router } from "express";
import express from "express";
import type {
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
import { LoginSchema, SignupSchema } from "./auth.schema";
import { LoginPage, SignupPage, VerifyEmailPage } from "./auth.component";
import { extractReturnUrl, parseReturnUrl } from "./parse-return-url";
import { buildVerificationEmailHtml } from "./verification-email";
import { flattenZodErrors } from "./flatten-zod-errors";

const TokenQuerySchema = z.object({ token: z.string().optional() }).passthrough();

const COOKIE_NAME = "hutch_sid";

const COOKIE_OPTIONS = {
	httpOnly: true,
	sameSite: "lax" as const,
	path: "/",
};

const EMAIL_FROM = "Fayner Brack <hutch@hutch-app.com>";

interface AuthDependencies {
	createUser: CreateUser;
	verifyCredentials: VerifyCredentials;
	createSession: CreateSession;
	destroySession: DestroySession;
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

	router.get("/login", (req: Request, res: Response) => {
		if (req.userId) {
			res.redirect(303, "/queue");
			return;
		}
		const returnUrl = extractReturnUrl(req.query);
		const result = LoginPage({ returnUrl }).to("text/html");
		res.status(result.statusCode).type("html").send(result.body);
	});

	router.post("/login", async (req: Request, res: Response) => {
		const returnUrl = extractReturnUrl(req.query);
		const parsed = LoginSchema.safeParse(req.body);

		if (!parsed.success) {
			const result = LoginPage({
				returnUrl,
				email: req.body?.email,
				errors: flattenZodErrors(parsed.error.issues),
			}).to("text/html");
			res.status(422).type("html").send(result.body);
			return;
		}

		const { email, password } = parsed.data;
		const credentials = await deps.verifyCredentials({ email, password });

		if (!credentials.ok) {
			const result = LoginPage({
				returnUrl,
				email,
				globalError: "Invalid email or password",
			}).to("text/html");
			res.status(422).type("html").send(result.body);
			return;
		}

		const sessionId = await deps.createSession({ userId: credentials.userId, emailVerified: credentials.emailVerified });
		res.cookie(COOKIE_NAME, sessionId, COOKIE_OPTIONS);
		res.redirect(303, parseReturnUrl(req.query));
	});

	router.get("/signup", (req: Request, res: Response) => {
		if (req.userId) {
			res.redirect(303, "/queue");
			return;
		}
		const returnUrl = extractReturnUrl(req.query);
		const result = SignupPage({ returnUrl }).to("text/html");
		res.status(result.statusCode).type("html").send(result.body);
	});

	router.post("/signup", async (req: Request, res: Response) => {
		const returnUrl = extractReturnUrl(req.query);
		const parsed = SignupSchema.safeParse(req.body);

		if (!parsed.success) {
			const result = SignupPage({
				returnUrl,
				email: req.body?.email,
				errors: flattenZodErrors(parsed.error.issues),
			}).to("text/html");
			res.status(422).type("html").send(result.body);
			return;
		}

		const { email, password } = parsed.data;
		const createResult = await deps.createUser({ email, password });

		if (!createResult.ok) {
			const result = SignupPage({
				returnUrl,
				email,
				globalError: "An account with this email already exists",
			}).to("text/html");
			res.status(422).type("html").send(result.body);
			return;
		}

		const sessionId = await deps.createSession({ userId: createResult.userId, emailVerified: false });
		res.cookie(COOKIE_NAME, sessionId, COOKIE_OPTIONS);
		res.redirect(303, parseReturnUrl(req.query));

		deps.createVerificationToken({ userId: createResult.userId, email })
			.then((token) => {
				const verifyUrl = `${deps.baseUrl}/verify-email?token=${token}`;
				const html = buildVerificationEmailHtml(verifyUrl);
				return deps.sendEmail({
					from: EMAIL_FROM,
					to: email,
					bcc: "hutch+account_verifications@hutch-app.com",
					subject: "Verify your email — Hutch",
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
			const result = VerifyEmailPage({
				success: false,
				error: "No verification token provided.",
			}).to("text/html");
			res.status(400).type("html").send(result.body);
			return;
		}

		const verifyResult = await deps.verifyEmailToken(VerificationTokenSchema.parse(token));

		if (!verifyResult.ok) {
			const result = VerifyEmailPage({
				success: false,
				error: "This verification link is invalid or has already been used.",
			}).to("text/html");
			res.status(400).type("html").send(result.body);
			return;
		}

		await deps.markEmailVerified(verifyResult.email);

		const sessionId = req.cookies?.[COOKIE_NAME];
		if (sessionId) {
			await deps.markSessionEmailVerified(sessionId);
		}

		const result = VerifyEmailPage({ success: true }).to("text/html");
		res.status(200).type("html").send(result.body);
	});

	router.post("/logout", async (req: Request, res: Response) => {
		const sessionId = req.cookies?.[COOKIE_NAME];
		if (sessionId) {
			await deps.destroySession(sessionId);
		}
		res.clearCookie(COOKIE_NAME, { path: "/" });
		res.redirect(303, "/");
	});

	return router;
}
