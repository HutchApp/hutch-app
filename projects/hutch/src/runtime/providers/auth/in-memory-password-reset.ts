import { randomBytes } from "node:crypto";
import type {
	CreatePasswordResetToken,
	PasswordResetToken,
	ResetPassword,
} from "./password-reset.types";
import { hashPassword } from "./password";

interface StoredResetToken {
	email: string;
	expiresAt: number;
}

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export function initInMemoryPasswordReset(deps: {
	userExists: (email: string) => boolean;
	updatePasswordHash: (email: string, hash: string) => void;
}): {
	createPasswordResetToken: CreatePasswordResetToken;
	resetPassword: ResetPassword;
} {
	const tokens = new Map<PasswordResetToken, StoredResetToken>();

	const createPasswordResetToken: CreatePasswordResetToken = async (email) => {
		const normalizedEmail = email.toLowerCase().trim();

		if (!deps.userExists(normalizedEmail)) {
			return { ok: false, reason: "user-not-found" };
		}

		const token = randomBytes(32).toString("hex") as PasswordResetToken;
		tokens.set(token, {
			email: normalizedEmail,
			expiresAt: Date.now() + TOKEN_TTL_MS,
		});

		return { ok: true, token };
	};

	const resetPassword: ResetPassword = async ({ token, newPassword }) => {
		const stored = tokens.get(token);

		if (!stored || stored.expiresAt < Date.now()) {
			tokens.delete(token);
			return { ok: false, reason: "invalid-or-expired-token" };
		}

		const passwordHash = await hashPassword(newPassword);
		deps.updatePasswordHash(stored.email, passwordHash);
		tokens.delete(token);

		return { ok: true };
	};

	return { createPasswordResetToken, resetPassword };
}
