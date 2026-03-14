import { randomBytes } from "node:crypto";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
	PutCommand,
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

			const expiresAt = item.expiresAt as number;
			if (expiresAt < Math.floor(Date.now() / 1000)) {
				return { ok: false, reason: "invalid-token" };
			}

			return {
				ok: true,
				userId: item.userId as UserId,
				email: item.email as string,
			};
		} catch (error) {
			if (error instanceof ConditionalCheckFailedException) {
				return { ok: false, reason: "invalid-token" };
			}
			throw error;
		}
	};

	return { createVerificationToken, verifyEmailToken };
}
