import { UserIdSchema } from "../../domain/user/user.schema";
import { GoogleIdSchema } from "./google-auth.schema";
import { initInMemoryGoogleAuth } from "./in-memory-google-auth";

describe("In-memory Google auth", () => {
	it("should return null for unknown Google ID", async () => {
		const { findUserByGoogleId } = initInMemoryGoogleAuth();
		const googleId = GoogleIdSchema.parse("unknown-google-id");

		const result = await findUserByGoogleId(googleId);

		expect(result).toBeNull();
	});

	it("should return userId after linking a Google account", async () => {
		const { findUserByGoogleId, linkGoogleAccount } = initInMemoryGoogleAuth();
		const googleId = GoogleIdSchema.parse("google-sub-123");
		const userId = UserIdSchema.parse("user-abc");

		await linkGoogleAccount({ googleId, userId, email: "test@example.com" });
		const result = await findUserByGoogleId(googleId);

		expect(result).toBe(userId);
	});

	it("should return null after unlinking a Google account", async () => {
		const { findUserByGoogleId, linkGoogleAccount, unlinkGoogleAccount } = initInMemoryGoogleAuth();
		const googleId = GoogleIdSchema.parse("google-sub-456");
		const userId = UserIdSchema.parse("user-xyz");

		await linkGoogleAccount({ googleId, userId, email: "test@example.com" });
		await unlinkGoogleAccount(googleId);
		const result = await findUserByGoogleId(googleId);

		expect(result).toBeNull();
	});
});
