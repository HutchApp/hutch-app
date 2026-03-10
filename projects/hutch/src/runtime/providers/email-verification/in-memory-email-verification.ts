import { randomBytes } from "node:crypto";
import type { UserId } from "../../domain/user/user.types";
import type {
	CreateVerificationToken,
	VerificationToken,
	VerifyEmailToken,
} from "./email-verification.types";

export function initInMemoryEmailVerification(): {
	createVerificationToken: CreateVerificationToken;
	verifyEmailToken: VerifyEmailToken;
} {
	const tokens = new Map<VerificationToken, UserId>();

	const createVerificationToken: CreateVerificationToken = async (userId) => {
		const token = randomBytes(32).toString("hex") as VerificationToken;
		tokens.set(token, userId);
		return token;
	};

	const verifyEmailToken: VerifyEmailToken = async (token) => {
		const userId = tokens.get(token);
		if (!userId) {
			return { ok: false, reason: "invalid-token" };
		}
		tokens.delete(token);
		return { ok: true, userId };
	};

	return { createVerificationToken, verifyEmailToken };
}
