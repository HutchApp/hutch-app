import { randomBytes } from "node:crypto";
import type {
	CreatePasswordResetToken,
	PasswordResetToken,
	VerifyPasswordResetToken,
} from "./password-reset.types";
import { PasswordResetTokenSchema } from "./password-reset.schema";

export function initInMemoryPasswordReset(): {
	createPasswordResetToken: CreatePasswordResetToken;
	verifyPasswordResetToken: VerifyPasswordResetToken;
} {
	const tokens = new Map<PasswordResetToken, { email: string }>();

	const createPasswordResetToken: CreatePasswordResetToken = async ({ email }) => {
		const token = PasswordResetTokenSchema.parse(randomBytes(32).toString("hex"));
		tokens.set(token, { email });
		return token;
	};

	const verifyPasswordResetToken: VerifyPasswordResetToken = async (token) => {
		const entry = tokens.get(token);
		if (!entry) {
			return { ok: false, reason: "invalid-token" };
		}
		tokens.delete(token);
		return { ok: true, email: entry.email };
	};

	return { createPasswordResetToken, verifyPasswordResetToken };
}
