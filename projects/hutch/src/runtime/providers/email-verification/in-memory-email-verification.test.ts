import type { UserId } from "../../domain/user/user.types";
import type { VerificationToken } from "./email-verification.types";
import { initInMemoryEmailVerification } from "./in-memory-email-verification";

describe("initInMemoryEmailVerification", () => {
	it("creates a token and verifies it successfully", async () => {
		const { createVerificationToken, verifyEmailToken } = initInMemoryEmailVerification();
		const userId = "user-1" as UserId;

		const token = await createVerificationToken({ userId, email: "user@example.com" });
		const result = await verifyEmailToken(token);

		expect(result).toEqual({ ok: true, userId, email: "user@example.com" });
	});

	it("rejects an unknown token", async () => {
		const { verifyEmailToken } = initInMemoryEmailVerification();

		const result = await verifyEmailToken("nonexistent-token" as VerificationToken);

		expect(result).toEqual({ ok: false, reason: "invalid-token" });
	});

	it("rejects a token that has already been consumed", async () => {
		const { createVerificationToken, verifyEmailToken } = initInMemoryEmailVerification();
		const token = await createVerificationToken({ userId: "user-1" as UserId, email: "a@b.com" });

		await verifyEmailToken(token);
		const secondAttempt = await verifyEmailToken(token);

		expect(secondAttempt).toEqual({ ok: false, reason: "invalid-token" });
	});
});
