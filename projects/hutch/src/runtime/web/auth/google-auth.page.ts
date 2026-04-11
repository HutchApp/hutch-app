import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response, Router } from "express";
import express from "express";
import { z } from "zod";
import { UserIdSchema } from "../../domain/user/user.schema";
import type { CreateGoogleUser, CreateSession } from "../../providers/auth/auth.types";
import type { FindUserByGoogleId, LinkGoogleAccount, UnlinkGoogleAccount } from "../../providers/google-auth/google-auth.schema";
import type { ExchangeGoogleCode } from "../../providers/google-auth/google-token.types";
import { extractReturnUrl, parseReturnUrl } from "./parse-return-url";
import { LoginPage } from "./auth.component";

const CallbackQuerySchema = z.object({
	code: z.string().min(1),
	state: z.string().min(1),
});

const StatePayloadSchema = z.object({
	nonce: z.string(),
	returnUrl: z.string().optional(),
	createdAt: z.number(),
});

const COOKIE_NAME = "hutch_sid";
const STATE_COOKIE = "hutch_gstate";
const STATE_TTL_MS = 5 * 60 * 1000;

const COOKIE_OPTIONS = {
	httpOnly: true,
	sameSite: "lax" as const,
	path: "/",
};

interface GoogleAuthDependencies {
	googleClientId: string;
	googleClientSecret: string;
	appOrigin: string;
	createSession: CreateSession;
	createGoogleUser: CreateGoogleUser;
	findUserByGoogleId: FindUserByGoogleId;
	linkGoogleAccount: LinkGoogleAccount;
	unlinkGoogleAccount: UnlinkGoogleAccount;
	exchangeGoogleCode: ExchangeGoogleCode;
	logError: (message: string, error?: Error) => void;
}

// V8 coverage: Use const + arrow function to avoid function declaration coverage quirks - see https://github.com/jestjs/jest/issues/11188
const signState = (payload: string, secret: string): string => {
	const mac = createHmac("sha256", secret).update(payload).digest("base64url");
	return `${payload}.${mac}`;
};

const verifyState = (signed: string, secret: string): string | null => {
	const dotIndex = signed.lastIndexOf(".");
	if (dotIndex === -1) return null;
	const payload = signed.slice(0, dotIndex);
	const expected = signState(payload, secret);
	if (signed.length !== expected.length) return null;
	const isValid = timingSafeEqual(Buffer.from(signed), Buffer.from(expected));
	if (!isValid) return null;
	return payload;
};

// V8 coverage: Use const + arrow function to avoid function declaration coverage quirks - see https://github.com/jestjs/jest/issues/11188
export const initGoogleAuthRoutes = (deps: GoogleAuthDependencies): Router => {
	const router = express.Router();
	const redirectUri = `${deps.appOrigin}/auth/google/callback`;

	router.get("/auth/google", (req: Request, res: Response) => {
		const returnUrl = extractReturnUrl(req.query);
		const nonce = randomBytes(16).toString("hex");
		const createdAt = Date.now();
		const statePayload = JSON.stringify({ nonce, returnUrl, createdAt });
		const signedState = signState(statePayload, deps.googleClientSecret);

		res.cookie(STATE_COOKIE, signedState, {
			...COOKIE_OPTIONS,
			maxAge: STATE_TTL_MS,
		});

		const params = new URLSearchParams({
			client_id: deps.googleClientId,
			redirect_uri: redirectUri,
			response_type: "code",
			scope: "openid email",
			state: signedState,
		});

		res.redirect(303, `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
	});

	router.get("/auth/google/callback", async (req: Request, res: Response) => {
		const parsedQuery = CallbackQuerySchema.safeParse(req.query);
		const stateCookie = req.cookies?.[STATE_COOKIE];

		res.clearCookie(STATE_COOKIE, { path: "/" });

		if (!parsedQuery.success || !stateCookie || parsedQuery.data.state !== stateCookie) {
			const result = LoginPage({ globalError: "Google sign-in failed. Please try again." }).to("text/html");
			res.status(400).type("html").send(result.body);
			return;
		}
		const { code, state: stateParam } = parsedQuery.data;

		const payload = verifyState(stateParam, deps.googleClientSecret);
		if (!payload) {
			const result = LoginPage({ globalError: "Google sign-in failed. Please try again." }).to("text/html");
			res.status(400).type("html").send(result.body);
			return;
		}

		// Payload was HMAC-verified above so its shape is trusted — an invalid shape indicates a bug.
		const stateData = StatePayloadSchema.parse(JSON.parse(payload));
		if (Date.now() - stateData.createdAt > STATE_TTL_MS) {
			const result = LoginPage({ globalError: "Google sign-in expired. Please try again." }).to("text/html");
			res.status(400).type("html").send(result.body);
			return;
		}

		let tokenResult: Awaited<ReturnType<ExchangeGoogleCode>>;
		try {
			tokenResult = await deps.exchangeGoogleCode(code);
		} catch (error) {
			deps.logError("[Google Auth] Token exchange failed", error instanceof Error ? error : new Error(String(error)));
			const result = LoginPage({ globalError: "Google sign-in failed. Please try again." }).to("text/html");
			res.status(400).type("html").send(result.body);
			return;
		}

		if (!tokenResult.emailVerified) {
			const result = LoginPage({ globalError: "Your Google account email is not verified." }).to("text/html");
			res.status(400).type("html").send(result.body);
			return;
		}

		const existingUserId = await deps.findUserByGoogleId(tokenResult.googleId);
		if (existingUserId) {
			const sessionId = await deps.createSession({ userId: existingUserId, emailVerified: true });
			res.cookie(COOKIE_NAME, sessionId, COOKIE_OPTIONS);
			res.redirect(303, parseReturnUrl({ return: stateData.returnUrl }));
			return;
		}

		const userId = UserIdSchema.parse(randomBytes(16).toString("hex"));
		// Link first so that createGoogleUser failure leaves no orphaned user. If createGoogleUser
		// then fails, we compensate by unlinking to keep the google_accounts table consistent and
		// avoid a permanent lockout on retry.
		await deps.linkGoogleAccount({ googleId: tokenResult.googleId, userId, email: tokenResult.email });

		const createResult = await deps.createGoogleUser({ email: tokenResult.email, userId });
		if (!createResult.ok) {
			await deps.unlinkGoogleAccount(tokenResult.googleId);
			const result = LoginPage({
				globalError: "An account with this email already exists. Please sign in with your password.",
				email: tokenResult.email,
			}).to("text/html");
			res.status(422).type("html").send(result.body);
			return;
		}

		const sessionId = await deps.createSession({ userId, emailVerified: true });
		res.cookie(COOKIE_NAME, sessionId, COOKIE_OPTIONS);
		res.redirect(303, parseReturnUrl({ return: stateData.returnUrl }));
	});

	return router;
}
