import { initInMemoryPasswordReset } from "./in-memory-password-reset";

describe("initInMemoryPasswordReset", () => {
	it("issues a token and verifies it once", async () => {
		const { createPasswordResetToken, verifyPasswordResetToken } = initInMemoryPasswordReset();

		const token = await createPasswordResetToken({ email: "user@example.com" });
		const first = await verifyPasswordResetToken(token);

		expect(first).toEqual({ ok: true, email: "user@example.com" });
	});

	it("rejects a token after it has been verified once (single-use)", async () => {
		const { createPasswordResetToken, verifyPasswordResetToken } = initInMemoryPasswordReset();

		const token = await createPasswordResetToken({ email: "user@example.com" });
		await verifyPasswordResetToken(token);

		expect(await verifyPasswordResetToken(token)).toEqual({
			ok: false,
			reason: "invalid-token",
		});
	});

	it("rejects an unknown token", async () => {
		const { createPasswordResetToken, verifyPasswordResetToken } = initInMemoryPasswordReset();
		const realToken = await createPasswordResetToken({ email: "user@example.com" });

		const unknown = `${realToken}-extra`;
		const PasswordResetTokenSchema = (await import("./password-reset.schema"))
			.PasswordResetTokenSchema;
		expect(
			await verifyPasswordResetToken(PasswordResetTokenSchema.parse(unknown)),
		).toEqual({ ok: false, reason: "invalid-token" });
	});
});
