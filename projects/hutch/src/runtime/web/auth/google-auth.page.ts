import assert from "node:assert";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response, Router } from "express";
import express from "express";
import { z } from "zod";
import { UserIdSchema } from "../../domain/user/user.schema";
import type { UserId } from "../../domain/user/user.types";
import type {
	CreateGoogleUser,
	CreateSession,
	FindUserByEmail,
	MarkEmailVerified,
} from "../../providers/auth/auth.types";
import type { ExchangeGoogleCode } from "../../providers/google-auth/google-token.types";
import { extractReturnUrl, parseReturnUrl } from "./parse-return-url";
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from "./session-cookie";
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

const STATE_COOKIE = "hutch_gstate";
const STATE_TTL_MS = 5 * 60 * 1000;

interface GoogleAuthDependencies {
	googleClientId: string;
	googleClientSecret: string;
	appOrigin: string;
	createSession: CreateSession;
	createGoogleUser: CreateGoogleUser;
	findUserByEmail: FindUserByEmail;
	markEmailVerified: MarkEmailVerified;
	exchangeGoogleCode: ExchangeGoogleCode;
	logError: (message: string, error?: Error) => void;
}

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
			...SESSION_COOKIE_OPTIONS,
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

		const getOrCreateUserId = async (): Promise<UserId> => {
			const existing = await deps.findUserByEmail(tokenResult.email);
			if (existing) {
				if (!existing.emailVerified) {
					await deps.markEmailVerified(tokenResult.email);
				}
				return existing.userId;
			}

			const newUserId = UserIdSchema.parse(randomBytes(16).toString("hex"));
			const created = await deps.createGoogleUser({ email: tokenResult.email, userId: newUserId });
			if (created.ok) return newUserId;

			const raced = await deps.findUserByEmail(tokenResult.email);
			assert(raced, "createGoogleUser said email-already-exists but findUserByEmail missed");
			if (!raced.emailVerified) {
				await deps.markEmailVerified(tokenResult.email);
			}
			return raced.userId;
		};

		const userId = await getOrCreateUserId();
		const sessionId = await deps.createSession({ userId, emailVerified: true });
		res.cookie(SESSION_COOKIE_NAME, sessionId, SESSION_COOKIE_OPTIONS);
		res.redirect(303, parseReturnUrl({ return: stateData.returnUrl }));
	});

	return router;
};
