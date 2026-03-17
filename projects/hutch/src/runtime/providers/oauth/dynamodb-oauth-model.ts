import assert from "node:assert";
import { z } from "zod";
import type {
	AuthorizationCode,
	Client,
	Falsey,
	RefreshToken,
	Token,
	User,
} from "@node-oauth/oauth2-server";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
	PutCommand,
	GetCommand,
	DeleteCommand,
	QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import type { UserId } from "../../domain/user/user.types";
import { getClient } from "./oauth-clients";
import type { OAuthModel } from "./oauth-model";
import { generateToken } from "./generate-token";

function toEpochSeconds(date: Date): number {
	return Math.floor(date.getTime() / 1000);
}

const AuthCodeRow = z.object({
	expiresAt: z.number(),
	clientId: z.string(),
	userId: z.string(),
	redirectUri: z.string(),
	codeChallenge: z.string(),
	codeChallengeMethod: z.enum(["S256", "plain"]),
	scope: z.array(z.string()).optional(),
});

const TokenRow = z.object({
	accessToken: z.string(),
	refreshToken: z.string(),
	accessTokenExpiresAt: z.number(),
	refreshTokenExpiresAt: z.number(),
	clientId: z.string(),
	userId: z.string(),
	scope: z.array(z.string()).optional(),
});

const RefreshIndexRow = z.object({
	accessToken: z.string(),
});

function rebuildClient(clientId: string): Client | null {
	const client = getClient(clientId);
	if (!client) return null;
	return {
		id: client.id,
		grants: client.grants,
		redirectUris: client.redirectUris,
	};
}

export function initDynamoDbOAuthModel(deps: {
	client: DynamoDBDocumentClient;
	tableName: string;
}): OAuthModel {
	const { client, tableName } = deps;

	return {
		async getClient(clientId: string, _clientSecret: string): Promise<Client | Falsey> {
			return rebuildClient(clientId);
		},

		async saveAuthorizationCode(
			code: AuthorizationCode,
			oauthClient: Client,
			user: User,
		): Promise<AuthorizationCode> {
			assert(code.codeChallenge, "PKCE code_challenge is required for authorization_code grants");

			await client.send(
				new PutCommand({
					TableName: tableName,
					Item: {
						pk: `code#${code.authorizationCode}`,
						clientId: oauthClient.id,
						userId: user.id,
						redirectUri: code.redirectUri,
						codeChallenge: code.codeChallenge,
						codeChallengeMethod: code.codeChallengeMethod ?? "S256",
						scope: code.scope,
						expiresAt: toEpochSeconds(code.expiresAt),
					},
				}),
			);

			return { ...code, client: oauthClient, user };
		},

		async getAuthorizationCode(
			authorizationCode: string,
		): Promise<AuthorizationCode | Falsey> {
			const result = await client.send(
				new GetCommand({
					TableName: tableName,
					Key: { pk: `code#${authorizationCode}` },
				}),
			);

			if (!result.Item) return null;

			const row = AuthCodeRow.parse(result.Item);
			const expiresAt = new Date(row.expiresAt * 1000);
			if (expiresAt < new Date()) {
				await client.send(
					new DeleteCommand({
						TableName: tableName,
						Key: { pk: `code#${authorizationCode}` },
					}),
				);
				return null;
			}

			const oauthClient = rebuildClient(row.clientId);
			if (!oauthClient) return null;

			return {
				authorizationCode,
				expiresAt,
				redirectUri: row.redirectUri,
				scope: row.scope,
				codeChallenge: row.codeChallenge,
				codeChallengeMethod: row.codeChallengeMethod,
				client: oauthClient,
				user: { id: row.userId },
			};
		},

		async revokeAuthorizationCode(code: AuthorizationCode): Promise<boolean> {
			const existing = await client.send(
				new GetCommand({
					TableName: tableName,
					Key: { pk: `code#${code.authorizationCode}` },
				}),
			);

			if (!existing.Item) return false;

			await client.send(
				new DeleteCommand({
					TableName: tableName,
					Key: { pk: `code#${code.authorizationCode}` },
				}),
			);
			return true;
		},

		async saveToken(token: Token, oauthClient: Client, user: User): Promise<Token> {
			const refreshToken = token.refreshToken ?? "";
			const accessTokenExpiresAt =
				token.accessTokenExpiresAt ?? new Date(Date.now() + 24 * 3600000);
			const refreshTokenExpiresAt =
				token.refreshTokenExpiresAt ?? new Date(Date.now() + 180 * 24 * 3600000);

			const ttl = toEpochSeconds(
				refreshTokenExpiresAt > accessTokenExpiresAt
					? refreshTokenExpiresAt
					: accessTokenExpiresAt,
			);

			await client.send(
				new PutCommand({
					TableName: tableName,
					Item: {
						pk: `token#${token.accessToken}`,
						userId: user.id,
						clientId: oauthClient.id,
						accessToken: token.accessToken,
						refreshToken,
						accessTokenExpiresAt: toEpochSeconds(accessTokenExpiresAt),
						refreshTokenExpiresAt: toEpochSeconds(refreshTokenExpiresAt),
						scope: token.scope,
						expiresAt: ttl,
					},
				}),
			);

			if (refreshToken) {
				await client.send(
					new PutCommand({
						TableName: tableName,
						Item: {
							pk: `refresh#${refreshToken}`,
							accessToken: token.accessToken,
							expiresAt: toEpochSeconds(refreshTokenExpiresAt),
						},
					}),
				);
			}

			return { ...token, client: oauthClient, user };
		},

		async getAccessToken(accessToken: string): Promise<Token | Falsey> {
			const result = await client.send(
				new GetCommand({
					TableName: tableName,
					Key: { pk: `token#${accessToken}` },
				}),
			);

			if (!result.Item) return null;

			const row = TokenRow.parse(result.Item);
			const accessTokenExpiresAt = new Date(row.accessTokenExpiresAt * 1000);
			if (accessTokenExpiresAt < new Date()) return null;

			const oauthClient = rebuildClient(row.clientId);
			if (!oauthClient) return null;

			return {
				accessToken: row.accessToken,
				accessTokenExpiresAt,
				refreshToken: row.refreshToken,
				refreshTokenExpiresAt: new Date(row.refreshTokenExpiresAt * 1000),
				scope: row.scope,
				client: oauthClient,
				user: { id: row.userId },
			};
		},

		async getRefreshToken(refreshToken: string): Promise<RefreshToken | Falsey> {
			const indexResult = await client.send(
				new GetCommand({
					TableName: tableName,
					Key: { pk: `refresh#${refreshToken}` },
				}),
			);

			if (!indexResult.Item) return null;

			const indexRow = RefreshIndexRow.parse(indexResult.Item);
			const tokenResult = await client.send(
				new GetCommand({
					TableName: tableName,
					Key: { pk: `token#${indexRow.accessToken}` },
				}),
			);

			if (!tokenResult.Item) return null;

			const row = TokenRow.parse(tokenResult.Item);
			const refreshTokenExpiresAt = new Date(row.refreshTokenExpiresAt * 1000);
			if (refreshTokenExpiresAt < new Date()) return null;

			const oauthClient = rebuildClient(row.clientId);
			if (!oauthClient) return null;

			return {
				refreshToken: row.refreshToken,
				refreshTokenExpiresAt,
				scope: row.scope,
				client: oauthClient,
				user: { id: row.userId },
			};
		},

		async revokeToken(token: RefreshToken): Promise<boolean> {
			const indexResult = await client.send(
				new GetCommand({
					TableName: tableName,
					Key: { pk: `refresh#${token.refreshToken}` },
				}),
			);

			if (!indexResult.Item) return false;

			const indexRow = RefreshIndexRow.parse(indexResult.Item);
			await client.send(
				new DeleteCommand({
					TableName: tableName,
					Key: { pk: `refresh#${token.refreshToken}` },
				}),
			);

			await client.send(
				new DeleteCommand({
					TableName: tableName,
					Key: { pk: `token#${indexRow.accessToken}` },
				}),
			);

			return true;
		},

		async verifyScope(_token: Token, _scope: string | string[]): Promise<boolean> {
			return true;
		},

		async revokeAllUserTokens(userId: UserId): Promise<void> {
			let exclusiveStartKey: Record<string, unknown> | undefined;

			do {
				const queryResult = await client.send(
					new QueryCommand({
						TableName: tableName,
						IndexName: "userId-index",
						KeyConditionExpression: "userId = :userId",
						ExpressionAttributeValues: { ":userId": userId },
						ExclusiveStartKey: exclusiveStartKey,
					}),
				);

				exclusiveStartKey = queryResult.LastEvaluatedKey;

				if (!queryResult.Items || queryResult.Items.length === 0) continue;

				for (const item of queryResult.Items) {
					const RevokeItemRow = z.object({ pk: z.string(), refreshToken: z.string().optional() });
					const parsed = RevokeItemRow.parse(item);

					if (parsed.pk.startsWith("token#") && parsed.refreshToken) {
						await client.send(
							new DeleteCommand({
								TableName: tableName,
								Key: { pk: `refresh#${parsed.refreshToken}` },
							}),
						);
					}

					await client.send(
						new DeleteCommand({
							TableName: tableName,
							Key: { pk: parsed.pk },
						}),
					);
				}
			} while (exclusiveStartKey);
		},

		generateAccessToken: async () => generateToken(),
		generateRefreshToken: async () => generateToken(),
		generateAuthorizationCode: async () => generateToken(),
	};
}
