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
			if (!code.codeChallenge) {
				throw new Error("PKCE code_challenge is required for authorization_code grants");
			}

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

			const expiresAt = new Date((result.Item.expiresAt as number) * 1000);
			if (expiresAt < new Date()) {
				await client.send(
					new DeleteCommand({
						TableName: tableName,
						Key: { pk: `code#${authorizationCode}` },
					}),
				);
				return null;
			}

			const oauthClient = rebuildClient(result.Item.clientId as string);
			if (!oauthClient) return null;

			return {
				authorizationCode,
				expiresAt,
				redirectUri: result.Item.redirectUri as string,
				scope: result.Item.scope as string[] | undefined,
				codeChallenge: result.Item.codeChallenge as string,
				codeChallengeMethod: result.Item.codeChallengeMethod as "S256" | "plain",
				client: oauthClient,
				user: { id: result.Item.userId as string },
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
				token.accessTokenExpiresAt ?? new Date(Date.now() + 3600000);
			const refreshTokenExpiresAt =
				token.refreshTokenExpiresAt ?? new Date(Date.now() + 30 * 24 * 3600000);

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

			const accessTokenExpiresAt = new Date(
				(result.Item.accessTokenExpiresAt as number) * 1000,
			);
			if (accessTokenExpiresAt < new Date()) return null;

			const oauthClient = rebuildClient(result.Item.clientId as string);
			if (!oauthClient) return null;

			return {
				accessToken: result.Item.accessToken as string,
				accessTokenExpiresAt,
				refreshToken: result.Item.refreshToken as string,
				refreshTokenExpiresAt: new Date(
					(result.Item.refreshTokenExpiresAt as number) * 1000,
				),
				scope: result.Item.scope as string[] | undefined,
				client: oauthClient,
				user: { id: result.Item.userId as string },
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

			const tokenResult = await client.send(
				new GetCommand({
					TableName: tableName,
					Key: { pk: `token#${indexResult.Item.accessToken}` },
				}),
			);

			if (!tokenResult.Item) return null;

			const refreshTokenExpiresAt = new Date(
				(tokenResult.Item.refreshTokenExpiresAt as number) * 1000,
			);
			if (refreshTokenExpiresAt < new Date()) return null;

			const oauthClient = rebuildClient(tokenResult.Item.clientId as string);
			if (!oauthClient) return null;

			return {
				refreshToken: tokenResult.Item.refreshToken as string,
				refreshTokenExpiresAt,
				scope: tokenResult.Item.scope as string[] | undefined,
				client: oauthClient,
				user: { id: tokenResult.Item.userId as string },
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

			await client.send(
				new DeleteCommand({
					TableName: tableName,
					Key: { pk: `refresh#${token.refreshToken}` },
				}),
			);

			await client.send(
				new DeleteCommand({
					TableName: tableName,
					Key: { pk: `token#${indexResult.Item.accessToken}` },
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

				exclusiveStartKey = queryResult.LastEvaluatedKey as Record<string, unknown> | undefined;

				if (!queryResult.Items || queryResult.Items.length === 0) continue;

				for (const item of queryResult.Items) {
					const pk = item.pk as string;

					if (pk.startsWith("token#") && item.refreshToken) {
						await client.send(
							new DeleteCommand({
								TableName: tableName,
								Key: { pk: `refresh#${item.refreshToken}` },
							}),
						);
					}

					await client.send(
						new DeleteCommand({
							TableName: tableName,
							Key: { pk },
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
