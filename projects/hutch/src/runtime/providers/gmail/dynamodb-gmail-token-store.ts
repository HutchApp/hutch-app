/* c8 ignore start -- thin AWS SDK wrapper, tested via integration */
import { z } from "zod";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { PutCommand, GetCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import type { UserId } from "../../domain/user/user.types";
import type { SaveGmailTokens, FindGmailTokens, DeleteGmailTokens } from "./gmail-token-store.types";

const GmailTokenRow = z.object({
	accessToken: z.string(),
	refreshToken: z.string(),
	expiresAt: z.number(),
});

export function initDynamoDbGmailTokenStore(deps: {
	client: DynamoDBDocumentClient;
	tableName: string;
}): {
	saveGmailTokens: SaveGmailTokens;
	findGmailTokens: FindGmailTokens;
	deleteGmailTokens: DeleteGmailTokens;
} {
	const { client, tableName } = deps;

	const saveGmailTokens: SaveGmailTokens = async ({ userId, tokens }) => {
		await client.send(new PutCommand({
			TableName: tableName,
			Item: {
				userId,
				accessToken: tokens.accessToken,
				refreshToken: tokens.refreshToken,
				expiresAt: tokens.expiresAt,
			},
		}));
	};

	const findGmailTokens: FindGmailTokens = async (userId: UserId) => {
		const result = await client.send(new GetCommand({
			TableName: tableName,
			Key: { userId },
		}));

		if (!result.Item) return null;

		const row = GmailTokenRow.parse(result.Item);
		return {
			accessToken: row.accessToken,
			refreshToken: row.refreshToken,
			expiresAt: row.expiresAt,
		};
	};

	const deleteGmailTokens: DeleteGmailTokens = async (userId: UserId) => {
		await client.send(new DeleteCommand({
			TableName: tableName,
			Key: { userId },
		}));
	};

	return { saveGmailTokens, findGmailTokens, deleteGmailTokens };
}
/* c8 ignore stop */
