import Handlebars from "handlebars";
import { Base } from "../base.component";
import type { Component } from "../component.types";

interface AuthorizePageParams {
	clientName: string;
	clientId: string;
	redirectUri: string;
	codeChallenge: string;
	state?: string;
}

const escapeHtml = Handlebars.Utils.escapeExpression;

const OAUTH_AUTHORIZE_STYLES = `
.oauth-authorize {
  padding: 80px 20px;
}

.oauth-authorize__container {
  max-width: 400px;
  margin: 0 auto;
}

.oauth-authorize__title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 12px;
  color: var(--foreground);
}

.oauth-authorize__text {
  color: var(--muted-foreground);
  margin-bottom: 24px;
  line-height: 1.6;
}

.oauth-authorize__buttons {
  display: flex;
  gap: 1rem;
}

.oauth-authorize__btn {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  border-radius: 4px;
  cursor: pointer;
}

.oauth-authorize__btn--approve {
  background: var(--primary);
  color: white;
  border: none;
}

.oauth-authorize__btn--deny {
  background: var(--background);
  border: 1px solid var(--border);
  color: var(--foreground);
}
`;

const OAUTH_CALLBACK_STYLES = `
.oauth-callback {
  padding: 120px 20px;
  text-align: center;
}

.oauth-callback__container {
  max-width: 400px;
  margin: 0 auto;
}

.oauth-callback__title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 12px;
  color: var(--foreground);
}

.oauth-callback__text {
  color: var(--muted-foreground);
}
`;

export function OAuthAuthorizePage(params: AuthorizePageParams): Component {
	const { clientName, clientId, redirectUri, codeChallenge, state } = params;

	const content = `
    <main class="oauth-authorize">
      <div class="oauth-authorize__container">
        <h1 class="oauth-authorize__title">Authorize ${escapeHtml(clientName)}</h1>
        <p class="oauth-authorize__text"><strong>${escapeHtml(clientName)}</strong> wants to access your Hutch account.</p>
        <form method="POST" action="/oauth/authorize">
          <input type="hidden" name="client_id" value="${escapeHtml(clientId)}">
          <input type="hidden" name="redirect_uri" value="${escapeHtml(redirectUri)}">
          <input type="hidden" name="response_type" value="code">
          <input type="hidden" name="code_challenge" value="${escapeHtml(codeChallenge)}">
          <input type="hidden" name="code_challenge_method" value="S256">
          ${state ? `<input type="hidden" name="state" value="${escapeHtml(state)}">` : ""}
          <div class="oauth-authorize__buttons">
            <button type="submit" name="action" value="approve" class="oauth-authorize__btn oauth-authorize__btn--approve">Approve</button>
            <button type="submit" name="action" value="deny" class="oauth-authorize__btn oauth-authorize__btn--deny">Deny</button>
          </div>
        </form>
      </div>
    </main>`;

	return Base({
		seo: {
			title: `Authorize ${clientName} — Hutch`,
			description: `${clientName} is requesting access to your Hutch account.`,
			canonicalUrl: "/oauth/authorize",
			robots: "noindex, nofollow",
		},
		styles: OAUTH_AUTHORIZE_STYLES,
		bodyClass: "page-oauth-authorize",
		content,
		isAuthenticated: true,
	});
}

export function OAuthCallbackPage(): Component {
	return Base({
		seo: {
			title: "Authorization Complete — Hutch",
			description: "OAuth authorization is complete.",
			canonicalUrl: "/oauth/callback",
			robots: "noindex, nofollow",
		},
		styles: OAUTH_CALLBACK_STYLES,
		bodyClass: "page-oauth-callback",
		content: `
    <main class="oauth-callback">
      <div class="oauth-callback__container">
        <h1 class="oauth-callback__title">Authorization Complete</h1>
        <p class="oauth-callback__text">You may close this window.</p>
      </div>
    </main>`,
		isAuthenticated: true,
	});
}
