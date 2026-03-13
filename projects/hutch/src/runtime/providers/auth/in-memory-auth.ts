import { randomBytes } from "node:crypto";
import type { UserId } from "../../domain/user/user.types";
import type {
	CreateSession,
	CreateUser,
	DestroySession,
	GetSessionUserId,
	VerifyCredentials,
} from "./auth.types";
import { normalizeEmail } from "./normalize-email";
import { hashPassword, verifyPassword } from "./password";

interface StoredUser {
	id: UserId;
	email: string;
	passwordHash: string;
}

export function initInMemoryAuth(): {
	createUser: CreateUser;
	verifyCredentials: VerifyCredentials;
	createSession: CreateSession;
	getSessionUserId: GetSessionUserId;
	destroySession: DestroySession;
} {
	const users = new Map<string, StoredUser>();
	const sessions = new Map<string, UserId>();

	const createUser: CreateUser = async ({ email, password }) => {
		const normalizedEmail = normalizeEmail(email);

		if (users.has(normalizedEmail)) {
			return { ok: false, reason: "email-already-exists" };
		}

		const userId = randomBytes(16).toString("hex") as UserId;
		const passwordHash = await hashPassword(password);

		users.set(normalizedEmail, { id: userId, email: normalizedEmail, passwordHash });

		return { ok: true, userId };
	};

	const verifyCredentials: VerifyCredentials = async ({ email, password }) => {
		const normalizedEmail = normalizeEmail(email);
		const user = users.get(normalizedEmail);

		if (!user) {
			return { ok: false, reason: "invalid-credentials" };
		}

		const valid = await verifyPassword(password, user.passwordHash);
		if (!valid) {
			return { ok: false, reason: "invalid-credentials" };
		}

		return { ok: true, userId: user.id };
	};

	const createSession: CreateSession = async (userId) => {
		const sessionId = randomBytes(32).toString("hex");
		sessions.set(sessionId, userId);
		return sessionId;
	};

	const getSessionUserId: GetSessionUserId = async (sessionId) => {
		return sessions.get(sessionId) ?? null;
	};

	const destroySession: DestroySession = async (sessionId) => {
		sessions.delete(sessionId);
	};

	return {
		createUser,
		verifyCredentials,
		createSession,
		getSessionUserId,
		destroySession,
	};
}
