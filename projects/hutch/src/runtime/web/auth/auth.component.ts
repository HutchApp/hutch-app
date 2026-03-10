import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Base } from "../base.component";
import type { Component } from "../component.types";
import { render } from "../render";
import { AUTH_STYLES } from "./auth.styles";
import { type FieldError, toFieldViewModel } from "./form-errors";

const LOGIN_TEMPLATE = readFileSync(join(__dirname, "login.template.html"), "utf-8");
const SIGNUP_TEMPLATE = readFileSync(join(__dirname, "signup.template.html"), "utf-8");

interface AuthFormData {
	email?: string;
	errors?: FieldError[];
	globalError?: string;
}

export function LoginPage(data?: AuthFormData): Component {
	const email = data?.email ?? "";
	const errors = data?.errors;

	const content = render(LOGIN_TEMPLATE, {
		email,
		globalError: data?.globalError,
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

export function SignupPage(data?: AuthFormData): Component {
	const email = data?.email ?? "";
	const errors = data?.errors;

	const content = render(SIGNUP_TEMPLATE, {
		email,
		globalError: data?.globalError,
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
