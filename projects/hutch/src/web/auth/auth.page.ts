import type { Request, Response, Router } from "express";
import express from "express";
import type {
	CreateSession,
	CreateUser,
	DestroySession,
	VerifyCredentials,
} from "../../providers/auth/auth.types";
import { Base } from "../base.component";
import { LoginSchema, SignupSchema } from "./auth.schema";
import { createLoginPageContent, createSignupPageContent } from "./auth.template";

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
	return issues.map((issue) => ({
		field: String(issue.path[issue.path.length - 1] ?? ""),
		message: issue.message,
	}));
}

export function initAuthRoutes(deps: AuthDependencies): Router {
	const router = express.Router();

	router.get("/login", (_req: Request, res: Response) => {
		const pageContent = createLoginPageContent();
		const component = Base(pageContent);
		const result = component.to("text/html");
		res.status(result.statusCode).type("html").send(result.body);
	});

	router.post("/login", async (req: Request, res: Response) => {
		const parsed = LoginSchema.safeParse(req.body);

		if (!parsed.success) {
			const pageContent = createLoginPageContent({
				email: req.body?.email,
				errors: flattenZodErrors(parsed.error.issues),
			});
			const component = Base(pageContent);
			const result = component.to("text/html");
			res.status(422).type("html").send(result.body);
			return;
		}

		const { email, password } = parsed.data;
		const credentials = await deps.verifyCredentials(email, password);

		if (!credentials.ok) {
			const pageContent = createLoginPageContent({
				email,
				globalError: "Invalid email or password",
			});
			const component = Base(pageContent);
			const result = component.to("text/html");
			res.status(422).type("html").send(result.body);
			return;
		}

		const sessionId = await deps.createSession(credentials.userId);
		res.cookie(COOKIE_NAME, sessionId, COOKIE_OPTIONS);
		res.redirect(303, "/queue");
	});

	router.get("/signup", (_req: Request, res: Response) => {
		const pageContent = createSignupPageContent();
		const component = Base(pageContent);
		const result = component.to("text/html");
		res.status(result.statusCode).type("html").send(result.body);
	});

	router.post("/signup", async (req: Request, res: Response) => {
		const parsed = SignupSchema.safeParse(req.body);

		if (!parsed.success) {
			const pageContent = createSignupPageContent({
				email: req.body?.email,
				errors: flattenZodErrors(parsed.error.issues),
			});
			const component = Base(pageContent);
			const result = component.to("text/html");
			res.status(422).type("html").send(result.body);
			return;
		}

		const { email, password } = parsed.data;
		const createResult = await deps.createUser(email, password);

		if (!createResult.ok) {
			const pageContent = createSignupPageContent({
				email,
				globalError: "An account with this email already exists",
			});
			const component = Base(pageContent);
			const result = component.to("text/html");
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
