import type { UserId } from "../../domain/user/user.types";
import { initInMemoryAuth } from "./in-memory-auth";

describe("initInMemoryAuth", () => {
	describe("createUser", () => {
		it("should create a user and return a userId", async () => {
			const auth = initInMemoryAuth();
			const result = await auth.createUser("test@example.com", "password123");

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(typeof result.userId).toBe("string");
				expect(result.userId.length).toBeGreaterThan(0);
			}
		});

		it("should reject duplicate email", async () => {
			const auth = initInMemoryAuth();
			await auth.createUser("test@example.com", "password123");
			const result = await auth.createUser("test@example.com", "otherpassword");

			expect(result).toEqual({ ok: false, reason: "email-already-exists" });
		});

		it("should treat emails as case-insensitive", async () => {
			const auth = initInMemoryAuth();
			await auth.createUser("Test@Example.COM", "password123");
			const result = await auth.createUser("test@example.com", "otherpassword");

			expect(result).toEqual({ ok: false, reason: "email-already-exists" });
		});

		it("should trim whitespace from emails", async () => {
			const auth = initInMemoryAuth();
			await auth.createUser("  test@example.com  ", "password123");
			const result = await auth.createUser("test@example.com", "otherpassword");

			expect(result).toEqual({ ok: false, reason: "email-already-exists" });
		});
	});

	describe("verifyCredentials", () => {
		it("should verify correct password", async () => {
			const auth = initInMemoryAuth();
			const createResult = await auth.createUser("test@example.com", "password123");
			if (!createResult.ok) throw new Error("User creation failed");

			const result = await auth.verifyCredentials("test@example.com", "password123");

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.userId).toBe(createResult.userId);
			}
		});

		it("should reject wrong password", async () => {
			const auth = initInMemoryAuth();
			await auth.createUser("test@example.com", "password123");

			const result = await auth.verifyCredentials("test@example.com", "wrongpassword");

			expect(result).toEqual({ ok: false, reason: "invalid-credentials" });
		});

		it("should reject nonexistent email", async () => {
			const auth = initInMemoryAuth();

			const result = await auth.verifyCredentials("noone@example.com", "password123");

			expect(result).toEqual({ ok: false, reason: "invalid-credentials" });
		});

		it("should verify with case-insensitive email", async () => {
			const auth = initInMemoryAuth();
			await auth.createUser("test@example.com", "password123");

			const result = await auth.verifyCredentials("TEST@Example.COM", "password123");

			expect(result.ok).toBe(true);
		});
	});

	describe("sessions", () => {
		it("should create a session and resolve the userId", async () => {
			const auth = initInMemoryAuth();
			const userId = "user-123" as UserId;
			const sessionId = await auth.createSession(userId);

			const resolved = await auth.getSessionUserId(sessionId);

			expect(resolved).toBe(userId);
		});

		it("should return null for unknown session", async () => {
			const auth = initInMemoryAuth();

			const resolved = await auth.getSessionUserId("nonexistent-session");

			expect(resolved).toBeNull();
		});

		it("should destroy a session", async () => {
			const auth = initInMemoryAuth();
			const userId = "user-123" as UserId;
			const sessionId = await auth.createSession(userId);

			await auth.destroySession(sessionId);
			const resolved = await auth.getSessionUserId(sessionId);

			expect(resolved).toBeNull();
		});
	});
});
