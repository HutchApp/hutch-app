import { UserIdSchema } from "./user.schema";

describe("UserIdSchema", () => {
	it("brands a string as UserId", () => {
		expect(UserIdSchema.parse("user-123")).toBe("user-123");
	});

	it("rejects non-strings", () => {
		expect(UserIdSchema.safeParse(42).success).toBe(false);
	});
});
