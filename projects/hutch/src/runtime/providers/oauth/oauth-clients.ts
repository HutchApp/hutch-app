import type { OAuthClient, OAuthClientId } from "../../domain/oauth/oauth.types";

const REGISTERED_CLIENTS: Record<string, OAuthClient> = {
	"hutch-firefox-extension": {
		id: "hutch-firefox-extension" as OAuthClientId,
		name: "Hutch Firefox Extension",
		redirectUris: [
			"https://extensions.hutch-app.com/callback",
			"http://localhost:3000/callback",
		],
		grants: ["authorization_code", "refresh_token"],
	},
};

export function getClient(
	clientId: string,
): OAuthClient | undefined {
	return REGISTERED_CLIENTS[clientId];
}

export function validateRedirectUri(
	clientId: string,
	redirectUri: string,
): boolean {
	const client = REGISTERED_CLIENTS[clientId];
	if (!client) return false;
	return client.redirectUris.includes(redirectUri);
}
