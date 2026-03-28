import type { UserId } from "../../domain/user/user.types";
import type { RefreshGmailAccessToken } from "./gmail-api.types";
import type { FindGmailTokens, SaveGmailTokens } from "./gmail-token-store.types";

const TOKEN_EXPIRY_BUFFER_MS = 60_000;

export type EnsureValidAccessToken = (userId: UserId) => Promise<string | null>;

export function initEnsureValidAccessToken(deps: {
	findGmailTokens: FindGmailTokens;
	saveGmailTokens: SaveGmailTokens;
	refreshGmailAccessToken: RefreshGmailAccessToken;
}): EnsureValidAccessToken {
	return async (userId) => {
		const tokens = await deps.findGmailTokens(userId);
		if (!tokens) return null;

		if (tokens.expiresAt < Date.now() + TOKEN_EXPIRY_BUFFER_MS) {
			const refreshed = await deps.refreshGmailAccessToken({
				refreshToken: tokens.refreshToken,
			});
			await deps.saveGmailTokens({ userId, tokens: refreshed });
			return refreshed.accessToken;
		}

		return tokens.accessToken;
	};
}
