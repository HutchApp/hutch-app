/* c8 ignore start -- thin AWS SDK wrapper, tested via integration */
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import type {
	CreatePasswordResetToken,
	VerifyPasswordResetToken,
} from "./password-reset.types";
import { PasswordResetTokenSchema } from "./password-reset.schema";

const TOKEN_TTL_SECONDS = 60 * 60; // 1 hour

const PasswordResetRow = z.object({
	expiresAt: z.number(),
	email: z.string(),
});

export function initDynamoDbPasswordReset(deps: {
	client: DynamoDBDocumentClient;
	tableName: string;
}): {
	createPasswordResetToken: CreatePasswordResetToken;
	verifyPasswordResetToken: VerifyPasswordResetToken;
} {
	const { client, tableName } = deps;

	const createPasswordResetToken: CreatePasswordResetToken = async ({ email }) => {
		const token = PasswordResetTokenSchema.parse(randomBytes(32).toString("hex"));
		const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;

		await client.send(
			new PutCommand({
				TableName: tableName,
				Item: { token, email, expiresAt },
			}),
		);

		return token;
	};

	const verifyPasswordResetToken: VerifyPasswordResetToken = async (token) => {
		try {
			const result = await client.send(
				new DeleteCommand({
					TableName: tableName,
					Key: { token },
					ConditionExpression: "attribute_exists(#tk)",
					ExpressionAttributeNames: { "#tk": "token" },
					ReturnValues: "ALL_OLD",
				}),
			);

			const item = result.Attributes;
			if (!item) {
				return { ok: false, reason: "invalid-token" };
			}

			const row = PasswordResetRow.parse(item);
			if (row.expiresAt < Math.floor(Date.now() / 1000)) {
				return { ok: false, reason: "invalid-token" };
			}

			return { ok: true, email: row.email };
		} catch (error) {
			if (error instanceof ConditionalCheckFailedException) {
				return { ok: false, reason: "invalid-token" };
			}
			throw error;
		}
	};

	return { createPasswordResetToken, verifyPasswordResetToken };
}
/* c8 ignore stop */
