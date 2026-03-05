import type { UserId } from "../../domain/user/user.types";
import type { OAuthClientId } from "../../domain/oauth/oauth.types";
import type {
	Token,
	Client,
	AuthorizationCode,
	RefreshToken,
} from "@node-oauth/oauth2-server";
import {
	createOAuthModel,
	initInMemoryOAuthModel,
	revokeAllUserTokens,
} from "./oauth-model";

const TEST_CLIENT_ID = "hutch-firefox-extension" as OAuthClientId;
const TEST_USER_ID = "user-123" as UserId;
const TEST_REDIRECT_URI = "http://127.0.0.1/callback";

describe("createOAuthModel", () => {
	describe("getClient", () => {
		it("returns registered client", async () => {
			const deps = initInMemoryOAuthModel();
			const model = createOAuthModel(deps);

			const client = await model.getClient(TEST_CLIENT_ID, "");

			expect(client).toBeDefined();
			expect((client as Client).id).toBe(TEST_CLIENT_ID);
			expect((client as Client).grants).toContain("authorization_code");
		});

		it("returns null for unknown client", async () => {
			const deps = initInMemoryOAuthModel();
			const model = createOAuthModel(deps);

			const client = await model.getClient("unknown-client", "");

			expect(client).toBeNull();
		});
	});

	describe("authorization code flow", () => {
		it("saves and retrieves authorization code", async () => {
			const deps = initInMemoryOAuthModel();
			const model = createOAuthModel(deps);

			const client = (await model.getClient(TEST_CLIENT_ID, "")) as Client;
			const code: Partial<AuthorizationCode> = {
				authorizationCode: "test-code-123",
				expiresAt: new Date(Date.now() + 300000),
				redirectUri: TEST_REDIRECT_URI,
				codeChallenge: "test-challenge",
				codeChallengeMethod: "S256",
				scope: undefined,
			};

			await model.saveAuthorizationCode(
				code as AuthorizationCode,
				client,
				{ id: TEST_USER_ID },
			);
			const retrieved = (await model.getAuthorizationCode(
				"test-code-123",
			)) as AuthorizationCode;

			expect(retrieved).toBeDefined();
			expect(retrieved.authorizationCode).toBe("test-code-123");
			expect(retrieved.codeChallenge).toBe("test-challenge");
			expect(retrieved.user.id).toBe(TEST_USER_ID);
		});

		it("returns null for expired authorization code", async () => {
			const deps = initInMemoryOAuthModel();
			const model = createOAuthModel(deps);

			const client = (await model.getClient(TEST_CLIENT_ID, "")) as Client;
			const code: Partial<AuthorizationCode> = {
				authorizationCode: "expired-code",
				expiresAt: new Date(Date.now() - 1000),
				redirectUri: TEST_REDIRECT_URI,
				codeChallenge: "test-challenge",
				codeChallengeMethod: "S256",
				scope: undefined,
			};

			await model.saveAuthorizationCode(
				code as AuthorizationCode,
				client,
				{ id: TEST_USER_ID },
			);
			const retrieved = await model.getAuthorizationCode("expired-code");

			expect(retrieved).toBeNull();
		});

		it("revokes authorization code", async () => {
			const deps = initInMemoryOAuthModel();
			const model = createOAuthModel(deps);

			const client = (await model.getClient(TEST_CLIENT_ID, "")) as Client;
			const code: Partial<AuthorizationCode> = {
				authorizationCode: "revoke-test-code",
				expiresAt: new Date(Date.now() + 300000),
				redirectUri: TEST_REDIRECT_URI,
				codeChallenge: "test-challenge",
				codeChallengeMethod: "S256",
				scope: undefined,
			};

			await model.saveAuthorizationCode(
				code as AuthorizationCode,
				client,
				{ id: TEST_USER_ID },
			);
			const fullCode = (await model.getAuthorizationCode(
				"revoke-test-code",
			)) as AuthorizationCode;

			const revoked = await model.revokeAuthorizationCode(fullCode);

			expect(revoked).toBe(true);
			expect(await model.getAuthorizationCode("revoke-test-code")).toBeNull();
		});
	});

	describe("token flow", () => {
		it("saves and retrieves access token", async () => {
			const deps = initInMemoryOAuthModel();
			const model = createOAuthModel(deps);

			const client = (await model.getClient(TEST_CLIENT_ID, "")) as Client;
			const token: Partial<Token> = {
				accessToken: "access-token-123",
				accessTokenExpiresAt: new Date(Date.now() + 3600000),
				refreshToken: "refresh-token-123",
				refreshTokenExpiresAt: new Date(Date.now() + 30 * 24 * 3600000),
				scope: undefined,
			};

			await model.saveToken(token as Token, client, { id: TEST_USER_ID });
			const retrieved = (await model.getAccessToken(
				"access-token-123",
			)) as Token;

			expect(retrieved).toBeDefined();
			expect(retrieved.accessToken).toBe("access-token-123");
			expect(retrieved.user.id).toBe(TEST_USER_ID);
		});

		it("returns null for expired access token", async () => {
			const deps = initInMemoryOAuthModel();
			const model = createOAuthModel(deps);

			const client = (await model.getClient(TEST_CLIENT_ID, "")) as Client;
			const token: Partial<Token> = {
				accessToken: "expired-access-token",
				accessTokenExpiresAt: new Date(Date.now() - 1000),
				refreshToken: "refresh-token-456",
				refreshTokenExpiresAt: new Date(Date.now() + 30 * 24 * 3600000),
				scope: undefined,
			};

			await model.saveToken(token as Token, client, { id: TEST_USER_ID });
			const retrieved = await model.getAccessToken("expired-access-token");

			expect(retrieved).toBeNull();
		});

		it("retrieves refresh token", async () => {
			const deps = initInMemoryOAuthModel();
			const model = createOAuthModel(deps);

			const client = (await model.getClient(TEST_CLIENT_ID, "")) as Client;
			const token: Partial<Token> = {
				accessToken: "access-token-789",
				accessTokenExpiresAt: new Date(Date.now() + 3600000),
				refreshToken: "refresh-token-789",
				refreshTokenExpiresAt: new Date(Date.now() + 30 * 24 * 3600000),
				scope: undefined,
			};

			await model.saveToken(token as Token, client, { id: TEST_USER_ID });
			const retrieved = (await model.getRefreshToken(
				"refresh-token-789",
			)) as RefreshToken;

			expect(retrieved).toBeDefined();
			expect(retrieved.refreshToken).toBe("refresh-token-789");
		});

		it("revokes token by refresh token", async () => {
			const deps = initInMemoryOAuthModel();
			const model = createOAuthModel(deps);

			const client = (await model.getClient(TEST_CLIENT_ID, "")) as Client;
			const token: Partial<Token> = {
				accessToken: "access-to-revoke",
				accessTokenExpiresAt: new Date(Date.now() + 3600000),
				refreshToken: "refresh-to-revoke",
				refreshTokenExpiresAt: new Date(Date.now() + 30 * 24 * 3600000),
				scope: undefined,
			};

			await model.saveToken(token as Token, client, { id: TEST_USER_ID });
			const refreshToken = (await model.getRefreshToken(
				"refresh-to-revoke",
			)) as RefreshToken;
			const revoked = await model.revokeToken(refreshToken);

			expect(revoked).toBe(true);
			expect(await model.getAccessToken("access-to-revoke")).toBeNull();
			expect(await model.getRefreshToken("refresh-to-revoke")).toBeNull();
		});
	});

	describe("revokeAllUserTokens", () => {
		it("revokes all tokens for a user", async () => {
			const deps = initInMemoryOAuthModel();
			const model = createOAuthModel(deps);

			const client = (await model.getClient(TEST_CLIENT_ID, "")) as Client;

			await model.saveToken(
				{
					accessToken: "user-token-1",
					accessTokenExpiresAt: new Date(Date.now() + 3600000),
					refreshToken: "user-refresh-1",
					refreshTokenExpiresAt: new Date(Date.now() + 30 * 24 * 3600000),
					scope: undefined,
				} as Token,
				client,
				{ id: TEST_USER_ID },
			);

			await model.saveToken(
				{
					accessToken: "user-token-2",
					accessTokenExpiresAt: new Date(Date.now() + 3600000),
					refreshToken: "user-refresh-2",
					refreshTokenExpiresAt: new Date(Date.now() + 30 * 24 * 3600000),
					scope: undefined,
				} as Token,
				client,
				{ id: TEST_USER_ID },
			);

			revokeAllUserTokens(deps, TEST_USER_ID);

			expect(await model.getAccessToken("user-token-1")).toBeNull();
			expect(await model.getAccessToken("user-token-2")).toBeNull();
			expect(await model.getRefreshToken("user-refresh-1")).toBeNull();
			expect(await model.getRefreshToken("user-refresh-2")).toBeNull();
		});

		it("does not affect other users tokens", async () => {
			const deps = initInMemoryOAuthModel();
			const model = createOAuthModel(deps);

			const client = (await model.getClient(TEST_CLIENT_ID, "")) as Client;
			const otherUserId = "other-user" as UserId;

			await model.saveToken(
				{
					accessToken: "user1-token",
					accessTokenExpiresAt: new Date(Date.now() + 3600000),
					refreshToken: "user1-refresh",
					refreshTokenExpiresAt: new Date(Date.now() + 30 * 24 * 3600000),
					scope: undefined,
				} as Token,
				client,
				{ id: TEST_USER_ID },
			);

			await model.saveToken(
				{
					accessToken: "user2-token",
					accessTokenExpiresAt: new Date(Date.now() + 3600000),
					refreshToken: "user2-refresh",
					refreshTokenExpiresAt: new Date(Date.now() + 30 * 24 * 3600000),
					scope: undefined,
				} as Token,
				client,
				{ id: otherUserId },
			);

			revokeAllUserTokens(deps, TEST_USER_ID);

			expect(await model.getAccessToken("user1-token")).toBeNull();
			expect(await model.getAccessToken("user2-token")).toBeDefined();
		});
	});

	describe("token generation", () => {
		it("generates unique access tokens", async () => {
			const deps = initInMemoryOAuthModel();
			const model = createOAuthModel(deps);

			const generateAccessToken = model.generateAccessToken;
			if (!generateAccessToken) {
				throw new Error("generateAccessToken not defined");
			}

			const dummyClient = { id: "test", grants: [] } as Client;
			const dummyUser = { id: "test-user" };

			const token1 = await generateAccessToken(dummyClient, dummyUser, []);
			const token2 = await generateAccessToken(dummyClient, dummyUser, []);

			expect(token1).not.toBe(token2);
			expect(token1.length).toBe(64);
		});

		it("generates unique refresh tokens", async () => {
			const deps = initInMemoryOAuthModel();
			const model = createOAuthModel(deps);

			const generateRefreshToken = model.generateRefreshToken;
			if (!generateRefreshToken) {
				throw new Error("generateRefreshToken not defined");
			}

			const dummyClient = { id: "test", grants: [] } as Client;
			const dummyUser = { id: "test-user" };

			const token1 = await generateRefreshToken(dummyClient, dummyUser, []);
			const token2 = await generateRefreshToken(dummyClient, dummyUser, []);

			expect(token1).not.toBe(token2);
			expect(token1.length).toBe(64);
		});
	});
});
