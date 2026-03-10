import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Base } from "../base.component";
import type { Component } from "../component.types";
import { render } from "../render";
import { AUTH_STYLES } from "./auth.styles";
import { type FieldError, toFieldViewModel } from "./form-errors";

const FORGOT_PASSWORD_TEMPLATE = readFileSync(join(__dirname, "forgot-password.template.html"), "utf-8");
const RESET_PASSWORD_TEMPLATE = readFileSync(join(__dirname, "reset-password.template.html"), "utf-8");

interface ForgotPasswordData {
	email?: string;
	errors?: FieldError[];
	globalError?: string;
	success?: boolean;
}

interface ResetPasswordData {
	token: string;
	errors?: FieldError[];
	globalError?: string;
}

export function ForgotPasswordPage(data?: ForgotPasswordData): Component {
	const email = data?.email ?? "";
	const errors = data?.errors;

	const content = render(FORGOT_PASSWORD_TEMPLATE, {
		email,
		globalError: data?.globalError,
		success: data?.success,
		emailField: toFieldViewModel(errors, "email"),
	});

	return Base({
		seo: {
			title: "Forgot password — Hutch",
			description: "Reset your Hutch account password.",
			canonicalUrl: "/forgot-password",
		},
		styles: AUTH_STYLES,
		bodyClass: "page-forgot-password",
		content,
	});
}

export function ResetPasswordPage(data: ResetPasswordData): Component {
	const errors = data.errors;

	const content = render(RESET_PASSWORD_TEMPLATE, {
		token: data.token,
		globalError: data.globalError,
		passwordField: toFieldViewModel(errors, "password"),
		confirmPasswordField: toFieldViewModel(errors, "confirmPassword"),
	});

	return Base({
		seo: {
			title: "Reset password — Hutch",
			description: "Set a new password for your Hutch account.",
			canonicalUrl: "/reset-password",
			robots: "noindex, nofollow",
		},
		styles: AUTH_STYLES,
		bodyClass: "page-reset-password",
		content,
	});
}
