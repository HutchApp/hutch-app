import { randomBytes } from "node:crypto";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
	PutCommand,
	GetCommand,
	DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type {
	CreatePasswordResetToken,
	PasswordResetToken,
	ResetPassword,
} from "./password-reset.types";
import { hashPassword } from "./password";

const TOKEN_TTL_SECONDS = 60 * 60; // 1 hour

export function initDynamoDbPasswordReset(deps: {
	client: DynamoDBDocumentClient;
	usersTableName: string;
	sessionsTableName: string;
}): {
	createPasswordResetToken: CreatePasswordResetToken;
	resetPassword: ResetPassword;
} {
	const { client, usersTableName, sessionsTableName } = deps;

	const createPasswordResetToken: CreatePasswordResetToken = async (email) => {
		const normalizedEmail = email.toLowerCase().trim();

		const userResult = await client.send(
			new GetCommand({
				TableName: usersTableName,
				Key: { email: normalizedEmail },
			}),
		);

		if (!userResult.Item) {
			return { ok: false, reason: "user-not-found" };
		}

		const token = randomBytes(32).toString("hex") as PasswordResetToken;
		const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;

		// Store the reset token in the sessions table with a "reset:" prefix
		await client.send(
			new PutCommand({
				TableName: sessionsTableName,
				Item: {
					sessionId: `reset:${token}`,
					email: normalizedEmail,
					expiresAt,
				},
			}),
		);

		return { ok: true, token };
	};

	const resetPassword: ResetPassword = async ({ token, newPassword }) => {
		const tokenKey = `reset:${token}`;

		const tokenResult = await client.send(
			new GetCommand({
				TableName: sessionsTableName,
				Key: { sessionId: tokenKey },
			}),
		);

		if (!tokenResult.Item) {
			return { ok: false, reason: "invalid-or-expired-token" };
		}

		const expiresAt = tokenResult.Item.expiresAt as number;
		if (expiresAt < Math.floor(Date.now() / 1000)) {
			await client.send(
				new DeleteCommand({
					TableName: sessionsTableName,
					Key: { sessionId: tokenKey },
				}),
			);
			return { ok: false, reason: "invalid-or-expired-token" };
		}

		const email = tokenResult.Item.email as string;
		const passwordHash = await hashPassword(newPassword);

		await client.send(
			new UpdateCommand({
				TableName: usersTableName,
				Key: { email },
				UpdateExpression: "SET passwordHash = :hash",
				ExpressionAttributeValues: { ":hash": passwordHash },
			}),
		);

		await client.send(
			new DeleteCommand({
				TableName: sessionsTableName,
				Key: { sessionId: tokenKey },
			}),
		);

		return { ok: true };
	};

	return { createPasswordResetToken, resetPassword };
}
