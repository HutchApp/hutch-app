import { Base } from "../base.component";
import type { Component } from "../component.types";
import { AUTH_STYLES } from "./auth.styles";

interface FieldError {
	field: string;
	message: string;
}

interface AuthFormData {
	email?: string;
	errors?: FieldError[];
	globalError?: string;
}

function renderFieldError(
	errors: FieldError[] | undefined,
	field: string,
): string {
	const error = errors?.find((e) => e.field === field);
	if (!error) return "";
	return `<p class="auth-form__error" data-test-error="${field}">${error.message}</p>`;
}

function fieldErrorClass(
	errors: FieldError[] | undefined,
	field: string,
): string {
	const hasError = errors?.some((e) => e.field === field);
	return hasError ? " auth-form__input--error" : "";
}

export function LoginPage(data?: AuthFormData): Component {
	const email = data?.email ?? "";
	const errors = data?.errors;
	const globalError = data?.globalError;

	const content = `
    <main class="auth-page">
      <div class="auth-card">
        <h1 class="auth-card__title">Welcome back</h1>
        <p class="auth-card__subtitle">Sign in to your Hutch account</p>
        ${globalError ? `<div class="auth-form__global-error" data-test-global-error>${globalError}</div>` : ""}
        <form class="auth-form" method="POST" action="/login" data-test-form="login">
          <div class="auth-form__field">
            <label class="auth-form__label" for="email">Email</label>
            <input class="auth-form__input${fieldErrorClass(errors, "email")}" type="email" id="email" name="email" value="${email}" required autocomplete="email">
            ${renderFieldError(errors, "email")}
          </div>
          <div class="auth-form__field">
            <label class="auth-form__label" for="password">Password</label>
            <input class="auth-form__input${fieldErrorClass(errors, "password")}" type="password" id="password" name="password" required autocomplete="current-password">
            ${renderFieldError(errors, "password")}
          </div>
          <button class="auth-form__submit" type="submit">Sign in</button>
        </form>
        <p class="auth-card__footer">
          Don't have an account? <a href="/signup">Create one</a>
        </p>
      </div>
    </main>`;

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
	const globalError = data?.globalError;

	const content = `
    <main class="auth-page">
      <div class="auth-card">
        <h1 class="auth-card__title">Create your account</h1>
        <p class="auth-card__subtitle">Start saving articles to read later</p>
        ${globalError ? `<div class="auth-form__global-error" data-test-global-error>${globalError}</div>` : ""}
        <form class="auth-form" method="POST" action="/signup" data-test-form="signup">
          <div class="auth-form__field">
            <label class="auth-form__label" for="email">Email</label>
            <input class="auth-form__input${fieldErrorClass(errors, "email")}" type="email" id="email" name="email" value="${email}" required autocomplete="email">
            ${renderFieldError(errors, "email")}
          </div>
          <div class="auth-form__field">
            <label class="auth-form__label" for="password">Password</label>
            <input class="auth-form__input${fieldErrorClass(errors, "password")}" type="password" id="password" name="password" required autocomplete="new-password" minlength="8">
            ${renderFieldError(errors, "password")}
          </div>
          <div class="auth-form__field">
            <label class="auth-form__label" for="confirmPassword">Confirm password</label>
            <input class="auth-form__input${fieldErrorClass(errors, "confirmPassword")}" type="password" id="confirmPassword" name="confirmPassword" required autocomplete="new-password">
            ${renderFieldError(errors, "confirmPassword")}
          </div>
          <button class="auth-form__submit" type="submit">Create account</button>
        </form>
        <p class="auth-card__footer">
          Already have an account? <a href="/login">Sign in</a>
        </p>
      </div>
    </main>`;

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
