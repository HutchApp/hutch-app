import type { Request, Response, Router } from "express";
import express from "express";
import type {
	CreateSession,
	CreateUser,
	DestroySession,
	VerifyCredentials,
} from "../../providers/auth/auth.types";
import { LoginSchema, SignupSchema } from "./auth.schema";
import { LoginPage, SignupPage } from "./auth.template";

const COOKIE_NAME = "hutch_sid";

const COOKIE_OPTIONS = {
	httpOnly: true,
	sameSite: "lax" as const,
	path: "/",
};

interface AuthDependencies {
	createUser: CreateUser;
	verifyCredentials: VerifyCredentials;
	createSession: CreateSession;
	destroySession: DestroySession;
}

function flattenZodErrors(
	issues: { path: PropertyKey[]; message: string }[],
): { field: string; message: string }[] {
	// Zod always populates the path array for field-level errors.
	// No fallback needed — removed nullish coalescing to avoid
	// V8 coverage branch on unreachable code path.
	// See: https://github.com/bcoe/c8/issues/126
	return issues.map((issue) => ({
		field: String(issue.path[issue.path.length - 1]),
		message: issue.message,
	}));
}

export function initAuthRoutes(deps: AuthDependencies): Router {
	const router = express.Router();

	router.get("/login", (_req: Request, res: Response) => {
		const result = LoginPage().to("text/html");
		res.status(result.statusCode).type("html").send(result.body);
	});

	router.post("/login", async (req: Request, res: Response) => {
		const parsed = LoginSchema.safeParse(req.body);

		if (!parsed.success) {
			const result = LoginPage({
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
				email,
				globalError: "Invalid email or password",
			}).to("text/html");
			res.status(422).type("html").send(result.body);
			return;
		}

		const sessionId = await deps.createSession(credentials.userId);
		res.cookie(COOKIE_NAME, sessionId, COOKIE_OPTIONS);
		res.redirect(303, "/queue");
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

		const sessionId = await deps.createSession(createResult.userId);
		res.cookie(COOKIE_NAME, sessionId, COOKIE_OPTIONS);
		res.redirect(303, "/queue");
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
