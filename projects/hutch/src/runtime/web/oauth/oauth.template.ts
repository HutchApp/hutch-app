interface AuthorizePageParams {
	clientName: string;
	clientId: string;
	redirectUri: string;
	codeChallenge: string;
	state?: string;
}

function escapeHtml(str: string): string {
	const htmlEscapes: Record<string, string> = {
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
		"'": "&#39;",
	};
	return str.replace(/[&<>"']/g, (c) => htmlEscapes[c] ?? c);
}

export function renderAuthorizePage(params: AuthorizePageParams): string {
	const { clientName, clientId, redirectUri, codeChallenge, state } = params;

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Authorize ${escapeHtml(clientName)}</title>
	<style>
		body { font-family: system-ui, sans-serif; max-width: 400px; margin: 40px auto; padding: 20px; }
		h1 { font-size: 1.5rem; margin-bottom: 1rem; }
		p { color: #666; margin-bottom: 1.5rem; }
		.buttons { display: flex; gap: 1rem; }
		button { padding: 0.75rem 1.5rem; font-size: 1rem; border-radius: 4px; cursor: pointer; }
		.approve { background: #2563eb; color: white; border: none; }
		.deny { background: white; border: 1px solid #ccc; }
	</style>
</head>
<body>
	<h1>Authorize ${escapeHtml(clientName)}</h1>
	<p><strong>${escapeHtml(clientName)}</strong> wants to access your Hutch account.</p>
	<form method="POST" action="/oauth/authorize">
		<input type="hidden" name="client_id" value="${escapeHtml(clientId)}">
		<input type="hidden" name="redirect_uri" value="${escapeHtml(redirectUri)}">
		<input type="hidden" name="response_type" value="code">
		<input type="hidden" name="code_challenge" value="${escapeHtml(codeChallenge)}">
		<input type="hidden" name="code_challenge_method" value="S256">
		${state ? `<input type="hidden" name="state" value="${escapeHtml(state)}">` : ""}
		<div class="buttons">
			<button type="submit" name="action" value="approve" class="approve">Approve</button>
			<button type="submit" name="action" value="deny" class="deny">Deny</button>
		</div>
	</form>
</body>
</html>`;
}
