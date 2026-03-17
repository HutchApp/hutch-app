import { hashPassword, verifyPassword } from "./password";

describe("hashPassword", () => {
	it("produces a salt:hash string", async () => {
		const hashed = await hashPassword("my-secret");
		const parts = hashed.split(":");

		expect(parts).toHaveLength(2);
		expect(parts[0].length).toBe(32);
		expect(parts[1].length).toBe(128);
	});

	it("produces different hashes for the same password", async () => {
		const first = await hashPassword("same-password");
		const second = await hashPassword("same-password");

		expect(first).not.toBe(second);
	});
});

describe("verifyPassword", () => {
	it("returns true for a matching password", async () => {
		const stored = await hashPassword("correct-password");

		const result = await verifyPassword("correct-password", stored);

		expect(result).toBe(true);
	});

	it("returns false for a wrong password", async () => {
		const stored = await hashPassword("correct-password");

		const result = await verifyPassword("wrong-password", stored);

		expect(result).toBe(false);
	});
});
