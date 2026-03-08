import { Base } from "../base.component";
import type { Component } from "../component.types";
import { render } from "../render";
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

const LOGIN_TEMPLATE = `
    <main class="auth-page">
      <div class="auth-card">
        <h1 class="auth-card__title">Welcome back</h1>
        <p class="auth-card__subtitle">Sign in to your Hutch account</p>
        {{#if globalError}}<div class="auth-form__global-error" data-test-global-error>{{globalError}}</div>{{/if}}
        <form class="auth-form" method="POST" action="/login" data-test-form="login">
          <div class="auth-form__field">
            <label class="auth-form__label" for="email">Email</label>
            <input class="auth-form__input{{emailField.errorClass}}" type="email" id="email" name="email" value="{{email}}" required autocomplete="email">
            {{#if emailField.error}}<p class="auth-form__error" data-test-error="email">{{emailField.error}}</p>{{/if}}
          </div>
          <div class="auth-form__field">
            <label class="auth-form__label" for="password">Password</label>
            <input class="auth-form__input{{passwordField.errorClass}}" type="password" id="password" name="password" required autocomplete="current-password">
            {{#if passwordField.error}}<p class="auth-form__error" data-test-error="password">{{passwordField.error}}</p>{{/if}}
          </div>
          <button class="auth-form__submit" type="submit">Sign in</button>
        </form>
        <p class="auth-card__footer">
          Don't have an account? <a href="/signup">Create one</a>
        </p>
      </div>
    </main>`;

const SIGNUP_TEMPLATE = `
    <main class="auth-page">
      <div class="auth-card">
        <h1 class="auth-card__title">Create your account</h1>
        <p class="auth-card__subtitle">Start saving articles to read later</p>
        {{#if globalError}}<div class="auth-form__global-error" data-test-global-error>{{globalError}}</div>{{/if}}
        <form class="auth-form" method="POST" action="/signup" data-test-form="signup">
          <div class="auth-form__field">
            <label class="auth-form__label" for="email">Email</label>
            <input class="auth-form__input{{emailField.errorClass}}" type="email" id="email" name="email" value="{{email}}" required autocomplete="email">
            {{#if emailField.error}}<p class="auth-form__error" data-test-error="email">{{emailField.error}}</p>{{/if}}
          </div>
          <div class="auth-form__field">
            <label class="auth-form__label" for="password">Password</label>
            <input class="auth-form__input{{passwordField.errorClass}}" type="password" id="password" name="password" required autocomplete="new-password" minlength="8">
            {{#if passwordField.error}}<p class="auth-form__error" data-test-error="password">{{passwordField.error}}</p>{{/if}}
          </div>
          <div class="auth-form__field">
            <label class="auth-form__label" for="confirmPassword">Confirm password</label>
            <input class="auth-form__input{{confirmPasswordField.errorClass}}" type="password" id="confirmPassword" name="confirmPassword" required autocomplete="new-password">
            {{#if confirmPasswordField.error}}<p class="auth-form__error" data-test-error="confirmPassword">{{confirmPasswordField.error}}</p>{{/if}}
          </div>
          <button class="auth-form__submit" type="submit">Create account</button>
        </form>
        <p class="auth-card__footer">
          Already have an account? <a href="/login">Sign in</a>
        </p>
      </div>
    </main>`;

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
