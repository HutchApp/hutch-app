import type { OAuthClient } from "../../domain/oauth/oauth.types";
import { OAuthClientIdSchema } from "../../domain/oauth/oauth.schema";

const REGISTERED_CLIENTS: Record<string, OAuthClient> = {
	"hutch-firefox-extension": {
		id: OAuthClientIdSchema.parse("hutch-firefox-extension"),
		name: "Hutch Firefox Extension",
		redirectUris: [
			"https://hutch-app.com/oauth/callback",
			"http://127.0.0.1:3000/oauth/callback",
		],
		grants: ["authorization_code", "refresh_token"],
	},
	"hutch-chrome-extension": {
		id: OAuthClientIdSchema.parse("hutch-chrome-extension"),
		name: "Hutch Chrome Extension",
		redirectUris: [
			"https://hutch-app.com/oauth/callback",
			"http://127.0.0.1:3000/oauth/callback",
			"http://127.0.0.1:3001/oauth/callback",
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
	if (/^http:\/\/127\.0\.0\.1:\d+\/oauth\/callback$/.test(params.redirectUri)) return true;
	return client.redirectUris.includes(params.redirectUri);
}
