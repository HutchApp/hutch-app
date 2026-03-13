import { randomBytes } from "node:crypto";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
	PutCommand,
	GetCommand,
	DeleteCommand,
	UpdateCommand,
	QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import type { UserId } from "../../domain/user/user.types";
import type {
	CreateSession,
	CreateUser,
	DestroySession,
	GetSessionUserId,
	IsEmailVerified,
	MarkEmailVerified,
	VerifyCredentials,
} from "./auth.types";
import { normalizeEmail } from "./normalize-email";
import { hashPassword, verifyPassword } from "./password";

export function initDynamoDbAuth(deps: {
	client: DynamoDBDocumentClient;
	usersTableName: string;
	sessionsTableName: string;
}): {
	createUser: CreateUser;
	verifyCredentials: VerifyCredentials;
	createSession: CreateSession;
	getSessionUserId: GetSessionUserId;
	destroySession: DestroySession;
	markEmailVerified: MarkEmailVerified;
	isEmailVerified: IsEmailVerified;
} {
	const { client, usersTableName, sessionsTableName } = deps;

	const createUser: CreateUser = async ({ email, password }) => {
		const normalizedEmail = normalizeEmail(email);
		const userId = randomBytes(16).toString("hex") as UserId;
		const passwordHash = await hashPassword(password);

		try {
			await client.send(
				new PutCommand({
					TableName: usersTableName,
					Item: { email: normalizedEmail, userId, passwordHash, emailVerified: false },
					ConditionExpression: "attribute_not_exists(email)",
				}),
			);
			return { ok: true, userId };
		} catch (error) {
			if (error instanceof ConditionalCheckFailedException) {
				return { ok: false, reason: "email-already-exists" };
			}
			throw error;
		}
	};

	const verifyCredentials: VerifyCredentials = async ({ email, password }) => {
		const normalizedEmail = normalizeEmail(email);

		const result = await client.send(
			new GetCommand({
				TableName: usersTableName,
				Key: { email: normalizedEmail },
			}),
		);

		if (!result.Item) {
			return { ok: false, reason: "invalid-credentials" };
		}

		const valid = await verifyPassword(
			password,
			result.Item.passwordHash as string,
		);
		if (!valid) {
			return { ok: false, reason: "invalid-credentials" };
		}

		return { ok: true, userId: result.Item.userId as UserId };
	};

	const createSession: CreateSession = async (userId) => {
		const sessionId = randomBytes(32).toString("hex");
		const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 days in seconds (TTL)

		await client.send(
			new PutCommand({
				TableName: sessionsTableName,
				Item: { sessionId, userId, expiresAt },
			}),
		);

		return sessionId;
	};

	const getSessionUserId: GetSessionUserId = async (sessionId) => {
		const result = await client.send(
			new GetCommand({
				TableName: sessionsTableName,
				Key: { sessionId },
			}),
		);

		if (!result.Item) return null;

		const expiresAt = result.Item.expiresAt as number;
		if (expiresAt < Math.floor(Date.now() / 1000)) {
			return null;
		}

		return result.Item.userId as UserId;
	};

	const destroySession: DestroySession = async (sessionId) => {
		await client.send(
			new DeleteCommand({
				TableName: sessionsTableName,
				Key: { sessionId },
			}),
		);
	};

	const markEmailVerified: MarkEmailVerified = async (email) => {
		const normalizedEmail = normalizeEmail(email);
		await client.send(
			new UpdateCommand({
				TableName: usersTableName,
				Key: { email: normalizedEmail },
				UpdateExpression: "SET emailVerified = :val",
				ConditionExpression: "attribute_exists(email)",
				ExpressionAttributeValues: { ":val": true },
			}),
		);
	};

	const isEmailVerified: IsEmailVerified = async (userId) => {
		const result = await client.send(
			new QueryCommand({
				TableName: usersTableName,
				IndexName: "userId-index",
				KeyConditionExpression: "userId = :uid",
				ExpressionAttributeValues: { ":uid": userId },
				Limit: 1,
			}),
		);

		if (!result.Items || result.Items.length === 0) {
			return false;
		}

		return result.Items[0].emailVerified === true;
	};

	return {
		createUser,
		verifyCredentials,
		createSession,
		getSessionUserId,
		destroySession,
		markEmailVerified,
		isEmailVerified,
	};
}
