/* c8 ignore start -- thin AWS SDK wrapper, tested via integration */
import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
	PutCommand,
	GetCommand,
	DeleteCommand,
	ScanCommand,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { UserIdSchema } from "../../domain/user/user.schema";
import type {
	CountUsers,
	CreateSession,
	CreateUser,
	DestroySession,
	GetSessionUserId,
	MarkEmailVerified,
	MarkSessionEmailVerified,
	VerifyCredentials,
} from "./auth.types";
import { normalizeEmail } from "./normalize-email";
import { hashPassword, verifyPassword } from "./password";

const CredentialsRow = z.object({
	passwordHash: z.string(),
	userId: UserIdSchema,
	emailVerified: z.boolean().optional(),
});

const SessionRow = z.object({
	expiresAt: z.number(),
	userId: UserIdSchema,
	emailVerified: z.boolean().optional(),
});

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
	countUsers: CountUsers;
	markEmailVerified: MarkEmailVerified;
	markSessionEmailVerified: MarkSessionEmailVerified;
} {
	const { client, usersTableName, sessionsTableName } = deps;

	const createUser: CreateUser = async ({ email, password }) => {
		const normalizedEmail = normalizeEmail(email);
		const userId = UserIdSchema.parse(randomBytes(16).toString("hex"));
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

		const row = CredentialsRow.parse(result.Item);
		const valid = await verifyPassword(password, row.passwordHash);
		if (!valid) {
			return { ok: false, reason: "invalid-credentials" };
		}

		return { ok: true, userId: row.userId, emailVerified: row.emailVerified === true };
	};

	const createSession: CreateSession = async ({ userId, emailVerified }) => {
		const sessionId = randomBytes(32).toString("hex");
		const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 days in seconds (TTL)

		await client.send(
			new PutCommand({
				TableName: sessionsTableName,
				Item: { sessionId, userId, emailVerified, expiresAt },
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

		const row = SessionRow.parse(result.Item);
		if (row.expiresAt < Math.floor(Date.now() / 1000)) {
			return null;
		}

		return {
			userId: row.userId,
			emailVerified: row.emailVerified === true,
		};
	};

	const destroySession: DestroySession = async (sessionId) => {
		await client.send(
			new DeleteCommand({
				TableName: sessionsTableName,
				Key: { sessionId },
			}),
		);
	};

	const countUsers: CountUsers = async () => {
		const result = await client.send(
			new ScanCommand({
				TableName: usersTableName,
				Select: "COUNT",
			}),
		);
		return result.Count ?? 0;
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

	const markSessionEmailVerified: MarkSessionEmailVerified = async (sessionId) => {
		await client.send(
			new UpdateCommand({
				TableName: sessionsTableName,
				Key: { sessionId },
				UpdateExpression: "SET emailVerified = :val",
				ExpressionAttributeValues: { ":val": true },
			}),
		);
	};

	return {
		createUser,
		verifyCredentials,
		createSession,
		getSessionUserId,
		destroySession,
		countUsers,
		markEmailVerified,
		markSessionEmailVerified,
	};
}
/* c8 ignore stop */
