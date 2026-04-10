import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response, Router } from "express";
import express from "express";
import { UserIdSchema } from "../../domain/user/user.schema";
import type { CreateGoogleUser, CreateSession } from "../../providers/auth/auth.types";
import type { FindUserByGoogleId, LinkGoogleAccount } from "../../providers/google-auth/google-auth.schema";
import type { ExchangeGoogleCode } from "../../providers/google-auth/google-token.types";
import { extractReturnUrl, parseReturnUrl } from "./parse-return-url";
import { LoginPage } from "./auth.component";

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
		const code = req.query.code as string | undefined;
		const stateParam = req.query.state as string | undefined;
		const stateCookie = req.cookies?.[STATE_COOKIE];

		res.clearCookie(STATE_COOKIE, { path: "/" });

		if (!code || !stateParam || !stateCookie || stateParam !== stateCookie) {
			const result = LoginPage({ globalError: "Google sign-in failed. Please try again." }).to("text/html");
			res.status(400).type("html").send(result.body);
			return;
		}

		const payload = verifyState(stateParam, deps.googleClientSecret);
		if (!payload) {
			const result = LoginPage({ globalError: "Google sign-in failed. Please try again." }).to("text/html");
			res.status(400).type("html").send(result.body);
			return;
		}

		const stateData = JSON.parse(payload) as { nonce: string; returnUrl?: string; createdAt: number };
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
		const createResult = await deps.createGoogleUser({ email: tokenResult.email, userId });
		if (!createResult.ok) {
			const result = LoginPage({
				globalError: "An account with this email already exists. Please sign in with your password.",
				email: tokenResult.email,
			}).to("text/html");
			res.status(422).type("html").send(result.body);
			return;
		}

		await deps.linkGoogleAccount({ googleId: tokenResult.googleId, userId, email: tokenResult.email });

		const sessionId = await deps.createSession({ userId, emailVerified: true });
		res.cookie(COOKIE_NAME, sessionId, COOKIE_OPTIONS);
		res.redirect(303, parseReturnUrl({ return: stateData.returnUrl }));
	});

	return router;
}
