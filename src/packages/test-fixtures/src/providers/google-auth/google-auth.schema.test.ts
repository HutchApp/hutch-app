import { GoogleIdSchema } from "./google-auth.schema";

describe("GoogleIdSchema", () => {
	it("brands a string as GoogleId", () => {
		expect(GoogleIdSchema.parse("google-user-123")).toBe("google-user-123");
	});

	it("rejects non-strings", () => {
		expect(GoogleIdSchema.safeParse(42).success).toBe(false);
	});
});
