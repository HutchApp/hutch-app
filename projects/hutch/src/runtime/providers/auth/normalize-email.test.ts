import { normalizeEmail } from "./normalize-email";

describe("normalizeEmail", () => {
	it("should lowercase the email", () => {
		expect(normalizeEmail("Test@Example.COM")).toBe("test@example.com");
	});

	it("should trim whitespace", () => {
		expect(normalizeEmail("  test@example.com  ")).toBe("test@example.com");
	});

	it("should strip plus alias from local part", () => {
		expect(normalizeEmail("jessika012023+whatever@gmail.com")).toBe("jessika012023@gmail.com");
	});

	it("should strip plus alias with multiple segments", () => {
		expect(normalizeEmail("user+tag+extra@example.com")).toBe("user@example.com");
	});

	it("should leave emails without plus alias unchanged", () => {
		expect(normalizeEmail("user@example.com")).toBe("user@example.com");
	});

	it("should handle plus alias with case and whitespace", () => {
		expect(normalizeEmail("  User+Alias@Example.COM  ")).toBe("user@example.com");
	});
});
