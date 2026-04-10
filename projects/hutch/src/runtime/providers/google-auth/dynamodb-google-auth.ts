/* c8 ignore start -- thin AWS SDK wrapper, tested via integration */
import { z } from "zod";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { UserIdSchema } from "../../domain/user/user.schema";
import type { FindUserByGoogleId, LinkGoogleAccount } from "./google-auth.schema";

const GoogleAccountRow = z.object({
	userId: UserIdSchema,
});

export function initDynamoDbGoogleAuth(deps: {
	client: DynamoDBDocumentClient;
	tableName: string;
}): {
	findUserByGoogleId: FindUserByGoogleId;
	linkGoogleAccount: LinkGoogleAccount;
} {
	const { client, tableName } = deps;

	const findUserByGoogleId: FindUserByGoogleId = async (googleId) => {
		const result = await client.send(
			new GetCommand({
				TableName: tableName,
				Key: { googleId: String(googleId) },
			}),
		);

		if (!result.Item) return null;

		const row = GoogleAccountRow.parse(result.Item);
		return row.userId;
	};

	const linkGoogleAccount: LinkGoogleAccount = async ({ googleId, userId, email }) => {
		await client.send(
			new PutCommand({
				TableName: tableName,
				Item: {
					googleId: String(googleId),
					userId: String(userId),
					email,
					linkedAt: new Date().toISOString(),
				},
			}),
		);
	};

	return { findUserByGoogleId, linkGoogleAccount };
}
/* c8 ignore stop */
