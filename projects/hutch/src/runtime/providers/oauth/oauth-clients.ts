import type { OAuthClient, OAuthClientId } from "../../domain/oauth/oauth.types";

const REGISTERED_CLIENTS: Record<string, OAuthClient> = {
	"hutch-firefox-extension": {
		id: "hutch-firefox-extension" as OAuthClientId,
		name: "Hutch Firefox Extension",
		redirectUris: [
			"https://hutch-app.com/oauth/callback",
			"http://127.0.0.1:3000/oauth/callback",
		],
		grants: ["authorization_code", "refresh_token"],
	},
	"hutch-chrome-extension": {
		id: "hutch-chrome-extension" as OAuthClientId,
		name: "Hutch Chrome Extension",
		redirectUris: [
			"https://hutch-app.com/oauth/callback",
			"http://127.0.0.1:3000/oauth/callback",
		],
		grants: ["authorization_code", "refresh_token"],
	},
};

export function getClient(
	clientId: string,
): OAuthClient | undefined {
	return REGISTERED_CLIENTS[clientId];
}

export function validateRedirectUri(params: {
	clientId: string;
	redirectUri: string;
}): boolean {
	const client = REGISTERED_CLIENTS[params.clientId];
	if (!client) return false;
	return client.redirectUris.includes(params.redirectUri);
}
