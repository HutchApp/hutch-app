import type { Request, Response, Router } from "express";
import express from "express";
import type { SendEmail } from "../../providers/email/email.types";
import type { UserExistsByEmail, UpdatePassword } from "../../providers/auth/auth.types";
import type {
	CreatePasswordResetToken,
	VerifyPasswordResetToken,
} from "../../providers/password-reset/password-reset.types";
import { PasswordResetTokenSchema } from "../../providers/password-reset/password-reset.schema";
import { z } from "zod";
import { ForgotPasswordSchema, ResetPasswordSchema } from "./auth.schema";
import { ForgotPasswordPage, ResetPasswordPage } from "./auth.component";
import { buildPasswordResetEmailHtml } from "./password-reset-email";

const TokenQuerySchema = z.object({ token: z.string().optional() }).passthrough();

const EMAIL_FROM = "Hutch <hutch@hutch-app.com>";

interface ForgotPasswordDependencies {
	sendEmail: SendEmail;
	userExistsByEmail: UserExistsByEmail;
	updatePassword: UpdatePassword;
	createPasswordResetToken: CreatePasswordResetToken;
	verifyPasswordResetToken: VerifyPasswordResetToken;
	baseUrl: string;
	logError: (message: string, error?: Error) => void;
}

function flattenZodErrors(
	issues: { path: PropertyKey[]; message: string }[],
): { field: string; message: string }[] {
	return issues.map((issue) => ({
		field: String(issue.path[issue.path.length - 1]),
		message: issue.message,
	}));
}

export function initForgotPasswordRoutes(deps: ForgotPasswordDependencies): Router {
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

		const result = ForgotPasswordPage({ sent: true }).to("text/html");
		res.status(200).type("html").send(result.body);

		deps.userExistsByEmail(email)
			.then(async (exists) => {
				if (!exists) return;
				const token = await deps.createPasswordResetToken({ email });
				const resetUrl = `${deps.baseUrl}/reset-password?token=${token}`;
				const html = buildPasswordResetEmailHtml(resetUrl);
				return deps.sendEmail({
					from: EMAIL_FROM,
					to: email,
					bcc: "hutch+password_resets@hutch-app.com",
					subject: "Reset your password — Hutch",
					html,
				});
			})
			.catch((err) => {
				deps.logError("[Email] Password reset email failed", err instanceof Error ? err : new Error(String(err)));
			});
	});

	router.get("/reset-password", (req: Request, res: Response) => {
		const parsed = TokenQuerySchema.safeParse(req.query);
		const token = parsed.success ? (parsed.data.token ?? "") : "";

		if (!token) {
			const result = ResetPasswordPage({
				error: "No reset token provided.",
			}).to("text/html");
			res.status(400).type("html").send(result.body);
			return;
		}

		const result = ResetPasswordPage({ token }).to("text/html");
		res.status(200).type("html").send(result.body);
	});

	router.post("/reset-password", async (req: Request, res: Response) => {
		const queryParsed = TokenQuerySchema.safeParse(req.query);
		const token = queryParsed.success ? (queryParsed.data.token ?? "") : "";

		if (!token) {
			const result = ResetPasswordPage({
				error: "No reset token provided.",
			}).to("text/html");
			res.status(400).type("html").send(result.body);
			return;
		}

		const parsed = ResetPasswordSchema.safeParse(req.body);

		if (!parsed.success) {
			const result = ResetPasswordPage({
				token,
				errors: flattenZodErrors(parsed.error.issues),
			}).to("text/html");
			res.status(422).type("html").send(result.body);
			return;
		}

		const verifyResult = await deps.verifyPasswordResetToken(PasswordResetTokenSchema.parse(token));

		if (!verifyResult.ok) {
			const result = ResetPasswordPage({
				error: "This reset link is invalid or has already been used.",
			}).to("text/html");
			res.status(400).type("html").send(result.body);
			return;
		}

		await deps.updatePassword({ email: verifyResult.email, password: parsed.data.password });

		const result = ResetPasswordPage({ success: true }).to("text/html");
		res.status(200).type("html").send(result.body);
	});

	return router;
}
