import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
	PutCommand,
	GetCommand,
	DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import type { UserId } from "../../domain/user/user.types";
import type {
	CreateSession,
	CreateUser,
	DestroySession,
	GetSessionUserId,
	VerifyCredentials,
} from "./auth.types";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16).toString("hex");
	const derived = (await scryptAsync(password, salt, 64)) as Buffer;
	return `${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(
	password: string,
	stored: string,
): Promise<boolean> {
	const [salt, hash] = stored.split(":");
	const derived = (await scryptAsync(password, salt, 64)) as Buffer;
	const storedBuffer = Buffer.from(hash, "hex");
	return timingSafeEqual(derived, storedBuffer);
}

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
} {
	const { client, usersTableName, sessionsTableName } = deps;

	const createUser: CreateUser = async ({ email, password }) => {
		const normalizedEmail = email.toLowerCase().trim();
		const userId = randomBytes(16).toString("hex") as UserId;
		const passwordHash = await hashPassword(password);

		try {
			await client.send(
				new PutCommand({
					TableName: usersTableName,
					Item: { email: normalizedEmail, userId, passwordHash },
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
		const normalizedEmail = email.toLowerCase().trim();

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

	return {
		createUser,
		verifyCredentials,
		createSession,
		getSessionUserId,
		destroySession,
	};
}
