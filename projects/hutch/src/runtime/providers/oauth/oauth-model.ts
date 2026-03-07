import type {
	AuthorizationCodeModel,
	RefreshTokenModel,
	Client,
	Token,
	AuthorizationCode,
	RefreshToken,
	User,
	Falsey,
} from "@node-oauth/oauth2-server";
import type { UserId } from "../../domain/user/user.types";
import type {
	AccessToken as AccessTokenBrand,
	AuthorizationCode as AuthorizationCodeBrand,
	OAuthClientId,
	RefreshToken as RefreshTokenBrand,
} from "../../domain/oauth/oauth.types";
import { getClient } from "./oauth-clients";
import { generateToken } from "./generate-token";

interface StoredAuthorizationCode {
	code: AuthorizationCodeBrand;
	clientId: OAuthClientId;
	userId: UserId;
	redirectUri: string;
	codeChallenge: string;
	codeChallengeMethod: string;
	expiresAt: Date;
	scope?: string[];
}

interface StoredToken {
	accessToken: AccessTokenBrand;
	accessTokenExpiresAt: Date;
	refreshToken: RefreshTokenBrand;
	refreshTokenExpiresAt: Date;
	clientId: OAuthClientId;
	userId: UserId;
	scope?: string[];
}

interface OAuthModelDeps {
	codes: Map<string, StoredAuthorizationCode>;
	tokens: Map<string, StoredToken>;
	refreshTokenIndex: Map<string, string>;
	userIdIndex: Map<string, Set<string>>;
}

export function initInMemoryOAuthModel(): OAuthModelDeps {
	return {
		codes: new Map(),
		tokens: new Map(),
		refreshTokenIndex: new Map(),
		userIdIndex: new Map(),
	};
}

export type OAuthModel = AuthorizationCodeModel &
	RefreshTokenModel & {
		revokeAllUserTokens(userId: UserId): Promise<void>;
	};

export function createOAuthModel(deps: OAuthModelDeps): OAuthModel {
	return {
		async getClient(clientId: string, _clientSecret: string): Promise<Client | Falsey> {
			const client = getClient(clientId);
			if (!client) return null;

			return {
				id: client.id,
				grants: client.grants,
				redirectUris: client.redirectUris,
			};
		},

		async saveAuthorizationCode(
			code: AuthorizationCode,
			client: Client,
			user: User,
		): Promise<AuthorizationCode> {
			if (!code.codeChallenge) {
				throw new Error("PKCE code_challenge is required for authorization_code grants");
			}
			const stored: StoredAuthorizationCode = {
				code: code.authorizationCode as AuthorizationCodeBrand,
				clientId: client.id as OAuthClientId,
				userId: user.id as UserId,
				redirectUri: code.redirectUri,
				codeChallenge: code.codeChallenge,
				codeChallengeMethod: code.codeChallengeMethod ?? "S256",
				expiresAt: code.expiresAt,
				scope: code.scope,
			};
			deps.codes.set(code.authorizationCode, stored);
			return {
				...code,
				client,
				user,
			};
		},

		async getAuthorizationCode(
			authorizationCode: string,
		): Promise<AuthorizationCode | Falsey> {
			const stored = deps.codes.get(authorizationCode);
			if (!stored) return null;

			if (stored.expiresAt < new Date()) {
				deps.codes.delete(authorizationCode);
				return null;
			}

			const client = getClient(stored.clientId);
			if (!client) return null;

			return {
				authorizationCode: stored.code,
				expiresAt: stored.expiresAt,
				redirectUri: stored.redirectUri,
				scope: stored.scope,
				codeChallenge: stored.codeChallenge,
				codeChallengeMethod: stored.codeChallengeMethod as "S256" | "plain",
				client: {
					id: client.id,
					grants: client.grants,
					redirectUris: client.redirectUris,
				},
				user: { id: stored.userId },
			};
		},

		async revokeAuthorizationCode(code: AuthorizationCode): Promise<boolean> {
			const existed = deps.codes.has(code.authorizationCode);
			deps.codes.delete(code.authorizationCode);
			return existed;
		},

		async saveToken(token: Token, client: Client, user: User): Promise<Token> {
			const refreshToken = token.refreshToken ?? "";
			const accessTokenExpiresAt =
				token.accessTokenExpiresAt ?? new Date(Date.now() + 3600000);
			const refreshTokenExpiresAt =
				token.refreshTokenExpiresAt ?? new Date(Date.now() + 30 * 24 * 3600000);

			const stored: StoredToken = {
				accessToken: token.accessToken as AccessTokenBrand,
				accessTokenExpiresAt,
				refreshToken: refreshToken as RefreshTokenBrand,
				refreshTokenExpiresAt,
				clientId: client.id as OAuthClientId,
				userId: user.id as UserId,
				scope: token.scope,
			};

			deps.tokens.set(token.accessToken, stored);
			if (refreshToken) {
				deps.refreshTokenIndex.set(refreshToken, token.accessToken);
			}

			const userTokens = deps.userIdIndex.get(user.id) ?? new Set();
			userTokens.add(token.accessToken);
			deps.userIdIndex.set(user.id, userTokens);

			return {
				...token,
				client,
				user,
			};
		},

		async getAccessToken(accessToken: string): Promise<Token | Falsey> {
			const stored = deps.tokens.get(accessToken);
			if (!stored) return null;

			if (stored.accessTokenExpiresAt < new Date()) {
				return null;
			}

			const client = getClient(stored.clientId);
			if (!client) return null;

			return {
				accessToken: stored.accessToken,
				accessTokenExpiresAt: stored.accessTokenExpiresAt,
				refreshToken: stored.refreshToken,
				refreshTokenExpiresAt: stored.refreshTokenExpiresAt,
				scope: stored.scope,
				client: {
					id: client.id,
					grants: client.grants,
					redirectUris: client.redirectUris,
				},
				user: { id: stored.userId },
			};
		},

		async getRefreshToken(refreshToken: string): Promise<RefreshToken | Falsey> {
			const accessToken = deps.refreshTokenIndex.get(refreshToken);
			if (!accessToken) return null;

			const stored = deps.tokens.get(accessToken);
			if (!stored) return null;

			if (stored.refreshTokenExpiresAt < new Date()) {
				return null;
			}

			const client = getClient(stored.clientId);
			if (!client) return null;

			return {
				refreshToken: stored.refreshToken,
				refreshTokenExpiresAt: stored.refreshTokenExpiresAt,
				scope: stored.scope,
				client: {
					id: client.id,
					grants: client.grants,
					redirectUris: client.redirectUris,
				},
				user: { id: stored.userId },
			};
		},

		async revokeToken(token: RefreshToken): Promise<boolean> {
			const accessToken = deps.refreshTokenIndex.get(token.refreshToken);
			if (!accessToken) return false;

			const stored = deps.tokens.get(accessToken);
			if (stored) {
				const userTokens = deps.userIdIndex.get(stored.userId);
				userTokens?.delete(accessToken);
			}

			deps.refreshTokenIndex.delete(token.refreshToken);
			deps.tokens.delete(accessToken);
			return true;
		},

		// TODO: Update this function when scopes are added. Currently returns true
		// because no scopes are implemented. Once scopes are added, this must
		// validate that the token has the requested scope(s).
		async verifyScope(_token: Token, _scope: string | string[]): Promise<boolean> {
			return true;
		},

		async revokeAllUserTokens(userId: UserId): Promise<void> {
			const accessTokens = deps.userIdIndex.get(userId);
			if (!accessTokens) return;

			for (const accessToken of accessTokens) {
				const stored = deps.tokens.get(accessToken);
				if (stored) {
					deps.refreshTokenIndex.delete(stored.refreshToken);
				}
				deps.tokens.delete(accessToken);
			}
			deps.userIdIndex.delete(userId);
		},

		generateAccessToken: async () => generateToken(),
		generateRefreshToken: async () => generateToken(),
		generateAuthorizationCode: async () => generateToken(),
	};
}
