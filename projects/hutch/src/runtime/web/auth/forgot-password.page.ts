import type { Request, Response, Router } from "express";
import express from "express";
import type { SendEmail } from "../../providers/email/email.types";
import type {
	CreatePasswordResetToken,
	ResetPassword,
	PasswordResetToken,
} from "../../providers/auth/password-reset.types";
import { ForgotPasswordSchema, ResetPasswordSchema } from "./auth.schema";
import {
	ForgotPasswordPage,
	ResetPasswordPage,
} from "./forgot-password.component";

interface ForgotPasswordDependencies {
	sendEmail: SendEmail;
	createPasswordResetToken: CreatePasswordResetToken;
	resetPassword: ResetPassword;
}

function flattenZodErrors(
	issues: { path: PropertyKey[]; message: string }[],
): { field: string; message: string }[] {
	return issues.map((issue) => ({
		field: String(issue.path[issue.path.length - 1]),
		message: issue.message,
	}));
}

function buildResetUrl(req: Request, token: string): string {
	const protocol = req.protocol;
	const host = req.get("host");
	return `${protocol}://${host}/reset-password?token=${token}`;
}

export function initForgotPasswordRoutes(
	deps: ForgotPasswordDependencies,
): Router {
	const router = express.Router();

	router.get("/forgot-password", (_req: Request, res: Response) => {
		const result = ForgotPasswordPage().to("text/html");
		res.status(result.statusCode).type("html").send(result.body);
	});

	router.post("/forgot-password", async (req: Request, res: Response) => {
		const parsed = ForgotPasswordSchema.safeParse(req.body);

		if (!parsed.success) {
			const result = ForgotPasswordPage({
				email: req.body?.email,
				errors: flattenZodErrors(parsed.error.issues),
			}).to("text/html");
			res.status(422).type("html").send(result.body);
			return;
		}

		const { email } = parsed.data;
		const tokenResult = await deps.createPasswordResetToken(email);

		if (tokenResult.ok) {
			const resetUrl = buildResetUrl(req, tokenResult.token);
			await deps.sendEmail({
				to: email,
				subject: "Reset your Hutch password",
				html: `<p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request this, you can safely ignore this email.</p>`,
			});
		}

		// Always show success to avoid leaking whether an email exists
		const result = ForgotPasswordPage({ success: true }).to("text/html");
		res.status(200).type("html").send(result.body);
	});

	router.get("/reset-password", (req: Request, res: Response) => {
		const token = req.query.token as string | undefined;

		if (!token) {
			res.redirect(303, "/forgot-password");
			return;
		}

		const result = ResetPasswordPage({ token }).to("text/html");
		res.status(result.statusCode).type("html").send(result.body);
	});

	router.post("/reset-password", async (req: Request, res: Response) => {
		const parsed = ResetPasswordSchema.safeParse(req.body);

		if (!parsed.success) {
			const token = (req.body?.token as string) ?? "";
			const result = ResetPasswordPage({
				token,
				errors: flattenZodErrors(parsed.error.issues),
			}).to("text/html");
			res.status(422).type("html").send(result.body);
			return;
		}

		const { token, password } = parsed.data;
		const resetResult = await deps.resetPassword({
			token: token as PasswordResetToken,
			newPassword: password,
		});

		if (!resetResult.ok) {
			const result = ResetPasswordPage({
				token,
				globalError:
					"This reset link is invalid or has expired. Please request a new one.",
			}).to("text/html");
			res.status(422).type("html").send(result.body);
			return;
		}

		res.redirect(303, "/login");
	});

	return router;
}
