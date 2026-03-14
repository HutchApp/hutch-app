import type { UserId } from "../../domain/user/user.types";
import { initInMemoryAuth } from "./in-memory-auth";

describe("initInMemoryAuth", () => {
	describe("createUser", () => {
		it("should create a user and return a userId", async () => {
			const auth = initInMemoryAuth();
			const result = await auth.createUser({ email: "test@example.com", password: "password123" });

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(typeof result.userId).toBe("string");
				expect(result.userId.length).toBeGreaterThan(0);
			}
		});

		it("should reject duplicate email", async () => {
			const auth = initInMemoryAuth();
			await auth.createUser({ email: "test@example.com", password: "password123" });
			const result = await auth.createUser({ email: "test@example.com", password: "otherpassword" });

			expect(result).toEqual({ ok: false, reason: "email-already-exists" });
		});

		it("should treat emails as case-insensitive", async () => {
			const auth = initInMemoryAuth();
			await auth.createUser({ email: "Test@Example.COM", password: "password123" });
			const result = await auth.createUser({ email: "test@example.com", password: "otherpassword" });

			expect(result).toEqual({ ok: false, reason: "email-already-exists" });
		});

		it("should trim whitespace from emails", async () => {
			const auth = initInMemoryAuth();
			await auth.createUser({ email: "  test@example.com  ", password: "password123" });
			const result = await auth.createUser({ email: "test@example.com", password: "otherpassword" });

			expect(result).toEqual({ ok: false, reason: "email-already-exists" });
		});
	});

	describe("verifyCredentials", () => {
		it("should verify correct password", async () => {
			const auth = initInMemoryAuth();
			const createResult = await auth.createUser({ email: "test@example.com", password: "password123" });
			if (!createResult.ok) throw new Error("User creation failed");

			const result = await auth.verifyCredentials({ email: "test@example.com", password: "password123" });

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.userId).toBe(createResult.userId);
			}
		});

		it("should reject wrong password", async () => {
			const auth = initInMemoryAuth();
			await auth.createUser({ email: "test@example.com", password: "password123" });

			const result = await auth.verifyCredentials({ email: "test@example.com", password: "wrongpassword" });

			expect(result).toEqual({ ok: false, reason: "invalid-credentials" });
		});

		it("should reject nonexistent email", async () => {
			const auth = initInMemoryAuth();

			const result = await auth.verifyCredentials({ email: "noone@example.com", password: "password123" });

			expect(result).toEqual({ ok: false, reason: "invalid-credentials" });
		});

		it("should verify with case-insensitive email", async () => {
			const auth = initInMemoryAuth();
			await auth.createUser({ email: "test@example.com", password: "password123" });

			const result = await auth.verifyCredentials({ email: "TEST@Example.COM", password: "password123" });

			expect(result.ok).toBe(true);
		});
	});

	describe("sessions", () => {
		it("should create a session and resolve the userId", async () => {
			const auth = initInMemoryAuth();
			const userId = "user-123" as UserId;
			const sessionId = await auth.createSession({ userId, emailVerified: false });

			const resolved = await auth.getSessionUserId(sessionId);

			expect(resolved).toEqual({ userId, emailVerified: false });
		});

		it("should return null for unknown session", async () => {
			const auth = initInMemoryAuth();

			const resolved = await auth.getSessionUserId("nonexistent-session");

			expect(resolved).toBeNull();
		});

		it("should destroy a session", async () => {
			const auth = initInMemoryAuth();
			const userId = "user-123" as UserId;
			const sessionId = await auth.createSession({ userId, emailVerified: false });

			await auth.destroySession(sessionId);
			const resolved = await auth.getSessionUserId(sessionId);

			expect(resolved).toBeNull();
		});
	});
});
