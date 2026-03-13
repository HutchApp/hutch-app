import { randomBytes } from "node:crypto";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
	PutCommand,
	GetCommand,
	DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import type { UserId } from "../../domain/user/user.types";
import type {
	CreateVerificationToken,
	VerificationToken,
	VerifyEmailToken,
} from "./email-verification.types";

const TOKEN_TTL_SECONDS = 24 * 60 * 60; // 24 hours

export function initDynamoDbEmailVerification(deps: {
	client: DynamoDBDocumentClient;
	tableName: string;
}): {
	createVerificationToken: CreateVerificationToken;
	verifyEmailToken: VerifyEmailToken;
} {
	const { client, tableName } = deps;

	const createVerificationToken: CreateVerificationToken = async ({ userId, email }) => {
		const token = randomBytes(32).toString("hex") as VerificationToken;
		const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;

		await client.send(
			new PutCommand({
				TableName: tableName,
				Item: { token, userId, email, expiresAt },
			}),
		);

		return token;
	};

	const verifyEmailToken: VerifyEmailToken = async (token) => {
		const result = await client.send(
			new GetCommand({
				TableName: tableName,
				Key: { token },
			}),
		);

		if (!result.Item) {
			return { ok: false, reason: "invalid-token" };
		}

		const expiresAt = result.Item.expiresAt as number;
		if (expiresAt < Math.floor(Date.now() / 1000)) {
			return { ok: false, reason: "invalid-token" };
		}

		await client.send(
			new DeleteCommand({
				TableName: tableName,
				Key: { token },
			}),
		);

		return {
			ok: true,
			userId: result.Item.userId as UserId,
			email: result.Item.email as string,
		};
	};

	return { createVerificationToken, verifyEmailToken };
}
