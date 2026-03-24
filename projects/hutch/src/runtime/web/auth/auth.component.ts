import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Base } from "../base.component";
import type { Component } from "../component.types";
import { render } from "../render";
import { AUTH_STYLES } from "./auth.styles";

const LOGIN_TEMPLATE = readFileSync(join(__dirname, "login.template.html"), "utf-8");
const SIGNUP_TEMPLATE = readFileSync(join(__dirname, "signup.template.html"), "utf-8");
const VERIFY_EMAIL_TEMPLATE = readFileSync(join(__dirname, "verify-email.template.html"), "utf-8");

interface FieldError {
	field: string;
	message: string;
}

interface AuthFormData {
	email?: string;
	errors?: FieldError[];
	globalError?: string;
	returnUrl?: string;
}

interface FieldViewModel {
	errorClass: string;
	error?: string;
}

function toFieldViewModel(
	errors: FieldError[] | undefined,
	field: string,
): FieldViewModel {
	const error = errors?.find((e) => e.field === field);
	return {
		errorClass: error ? " auth-form__input--error" : "",
		error: error?.message,
	};
}

export function LoginPage(data?: AuthFormData): Component {
	const email = data?.email ?? "";
	const errors = data?.errors;

	const content = render(LOGIN_TEMPLATE, {
		email,
		globalError: data?.globalError,
		returnUrl: data?.returnUrl ? encodeURIComponent(data.returnUrl) : undefined,
		emailField: toFieldViewModel(errors, "email"),
		passwordField: toFieldViewModel(errors, "password"),
	});

	return Base({
		seo: {
			title: "Sign in — Hutch",
			description: "Sign in to your Hutch read-it-later account.",
			canonicalUrl: "/login",
		},
		styles: AUTH_STYLES,
		bodyClass: "page-login",
		content,
	});
}

export function VerifyEmailPage(data: { success: boolean; error?: string }): Component {
	const content = render(VERIFY_EMAIL_TEMPLATE, data);

	return Base({
		seo: {
			title: "Verify email — Hutch",
			description: "Email verification for your Hutch account.",
			canonicalUrl: "/verify-email",
			robots: "noindex, nofollow",
		},
		styles: AUTH_STYLES,
		bodyClass: "page-verify-email",
		content,
	});
}

export function SignupPage(data?: AuthFormData): Component {
	const email = data?.email ?? "";
	const errors = data?.errors;

	const content = render(SIGNUP_TEMPLATE, {
		email,
		globalError: data?.globalError,
		returnUrl: data?.returnUrl ? encodeURIComponent(data.returnUrl) : undefined,
		emailField: toFieldViewModel(errors, "email"),
		passwordField: toFieldViewModel(errors, "password"),
		confirmPasswordField: toFieldViewModel(errors, "confirmPassword"),
	});

	return Base({
		seo: {
			title: "Sign up — Hutch",
			description:
				"Create a free Hutch account and start saving articles to read later.",
			canonicalUrl: "/signup",
		},
		styles: AUTH_STYLES,
		bodyClass: "page-signup",
		content,
	});
}
