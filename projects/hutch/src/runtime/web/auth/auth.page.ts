import type { Request, Response, Router } from "express";
import express from "express";
import type {
	CreateSession,
	CreateUser,
	DestroySession,
	VerifyCredentials,
} from "../../providers/auth/auth.types";
import type { SendEmail } from "../../providers/email/email.types";
import type {
	CreateVerificationToken,
	VerificationToken,
	VerifyEmailToken,
} from "../../providers/email-verification/email-verification.types";
import { LoginSchema, SignupSchema } from "./auth.schema";
import { LoginPage, SignupPage, VerifyEmailPage } from "./auth.component";
import { buildVerificationEmailHtml } from "./verification-email";

const COOKIE_NAME = "hutch_sid";

const COOKIE_OPTIONS = {
	httpOnly: true,
	sameSite: "lax" as const,
	path: "/",
};

const EMAIL_FROM = "Hutch <noreply@hutch.sh>";

interface AuthDependencies {
	createUser: CreateUser;
	verifyCredentials: VerifyCredentials;
	createSession: CreateSession;
	destroySession: DestroySession;
	sendEmail: SendEmail;
	createVerificationToken: CreateVerificationToken;
	verifyEmailToken: VerifyEmailToken;
	baseUrl: string;
}

function flattenZodErrors(
	issues: { path: PropertyKey[]; message: string }[],
): { field: string; message: string }[] {
	return issues.map((issue) => ({
		field: String(issue.path[issue.path.length - 1]),
		message: issue.message,
	}));
}

export function initAuthRoutes(deps: AuthDependencies): Router {
	const router = express.Router();

	router.get("/login", (req: Request, res: Response) => {
		const returnUrl = typeof req.query.return === "string" ? req.query.return : undefined;
		const result = LoginPage({ returnUrl }).to("text/html");
		res.status(result.statusCode).type("html").send(result.body);
	});

	router.post("/login", async (req: Request, res: Response) => {
		const returnUrl = typeof req.query.return === "string" ? req.query.return : undefined;
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

		const sessionId = await deps.createSession(credentials.userId);
		res.cookie(COOKIE_NAME, sessionId, COOKIE_OPTIONS);
		const redirectTo = returnUrl?.startsWith("/") && !returnUrl.startsWith("//") ? returnUrl : "/queue";
		res.redirect(303, redirectTo);
	});

	router.get("/signup", (_req: Request, res: Response) => {
		const result = SignupPage().to("text/html");
		res.status(result.statusCode).type("html").send(result.body);
	});

	router.post("/signup", async (req: Request, res: Response) => {
		const parsed = SignupSchema.safeParse(req.body);

		if (!parsed.success) {
			const result = SignupPage({
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
				email,
				globalError: "An account with this email already exists",
			}).to("text/html");
			res.status(422).type("html").send(result.body);
			return;
		}

		const token = await deps.createVerificationToken(createResult.userId);
		const verifyUrl = `${deps.baseUrl}/verify-email?token=${token}`;
		const html = buildVerificationEmailHtml(verifyUrl);

		await deps.sendEmail({
			from: EMAIL_FROM,
			to: email,
			subject: "Verify your email — Hutch",
			html,
		});

		const sessionId = await deps.createSession(createResult.userId);
		res.cookie(COOKIE_NAME, sessionId, COOKIE_OPTIONS);
		res.redirect(303, "/queue");
	});

	router.get("/verify-email", async (req: Request, res: Response) => {
		const token = typeof req.query.token === "string" ? req.query.token : "";

		if (!token) {
			const result = VerifyEmailPage({
				success: false,
				error: "No verification token provided.",
			}).to("text/html");
			res.status(400).type("html").send(result.body);
			return;
		}

		const verifyResult = await deps.verifyEmailToken(token as VerificationToken);

		if (!verifyResult.ok) {
			const result = VerifyEmailPage({
				success: false,
				error: "This verification link is invalid or has already been used.",
			}).to("text/html");
			res.status(400).type("html").send(result.body);
			return;
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
