import assert from "node:assert/strict";
import type { UserId } from "../../domain/user/user.types";
import { UserIdSchema } from "../../domain/user/user.schema";
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

		it("should treat plus aliases as separate users", async () => {
			const auth = initInMemoryAuth();
			await auth.createUser({ email: "user@example.com", password: "password123" });
			const result = await auth.createUser({ email: "user+tag@example.com", password: "password456" });

			expect(result.ok).toBe(true);
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

		it("should not match plus alias against base email", async () => {
			const auth = initInMemoryAuth();
			await auth.createUser({ email: "user@example.com", password: "password123" });

			const result = await auth.verifyCredentials({ email: "user+tag@example.com", password: "password123" });

			expect(result).toEqual({ ok: false, reason: "invalid-credentials" });
		});

		it("should verify with case-insensitive email", async () => {
			const auth = initInMemoryAuth();
			await auth.createUser({ email: "test@example.com", password: "password123" });

			const result = await auth.verifyCredentials({ email: "TEST@Example.COM", password: "password123" });

			expect(result.ok).toBe(true);
		});
	});

	describe("countUsers", () => {
		it("should return zero when no users exist", async () => {
			const auth = initInMemoryAuth();

			const count = await auth.countUsers();

			expect(count).toBe(0);
		});

		it("should return the number of registered users", async () => {
			const auth = initInMemoryAuth();
			await auth.createUser({ email: "a@example.com", password: "password123" });
			await auth.createUser({ email: "b@example.com", password: "password456" });

			const count = await auth.countUsers();

			expect(count).toBe(2);
		});
	});

	describe("markEmailVerified", () => {
		it("should mark user email as verified", async () => {
			const auth = initInMemoryAuth();
			await auth.createUser({ email: "user@example.com", password: "password123" });

			await auth.markEmailVerified("user@example.com");
			const result = await auth.verifyCredentials({ email: "user@example.com", password: "password123" });

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.emailVerified).toBe(true);
			}
		});

		it("should handle case-insensitive email lookup", async () => {
			const auth = initInMemoryAuth();
			await auth.createUser({ email: "user@example.com", password: "password123" });

			await auth.markEmailVerified("User@Example.COM");
			const result = await auth.verifyCredentials({ email: "user@example.com", password: "password123" });

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.emailVerified).toBe(true);
			}
		});
	});

	describe("markSessionEmailVerified", () => {
		it("should mark session emailVerified flag to true", async () => {
			const auth = initInMemoryAuth();
			const userId = "user-456" as UserId;
			const sessionId = await auth.createSession({ userId, emailVerified: false });

			await auth.markSessionEmailVerified(sessionId);
			const session = await auth.getSessionUserId(sessionId);

			expect(session).toEqual({ userId, emailVerified: true });
		});

		it("should be a no-op for unknown sessions", async () => {
			const auth = initInMemoryAuth();

			await auth.markSessionEmailVerified("nonexistent-session");
		});
	});

	describe("findUserByEmail", () => {
		it("should return null for unknown email", async () => {
			const auth = initInMemoryAuth();

			const result = await auth.findUserByEmail("noone@example.com");

			expect(result).toBeNull();
		});

		it("should return userId and unverified flag after createUser", async () => {
			const auth = initInMemoryAuth();
			const created = await auth.createUser({ email: "test@example.com", password: "password123" });
			assert(created.ok, "User creation failed");

			const result = await auth.findUserByEmail("test@example.com");

			expect(result).toEqual({ userId: created.userId, emailVerified: false });
		});

		it("should reflect markEmailVerified", async () => {
			const auth = initInMemoryAuth();
			await auth.createUser({ email: "test@example.com", password: "password123" });
			await auth.markEmailVerified("test@example.com");

			const result = await auth.findUserByEmail("test@example.com");

			expect(result?.emailVerified).toBe(true);
		});

		it("should handle case-insensitive email lookup", async () => {
			const auth = initInMemoryAuth();
			const created = await auth.createUser({ email: "user@example.com", password: "password123" });
			assert(created.ok, "User creation failed");

			const result = await auth.findUserByEmail("USER@Example.COM");

			expect(result).toEqual({ userId: created.userId, emailVerified: false });
		});
	});

	describe("createGoogleUser", () => {
		it("should create a user without a password and verified email", async () => {
			const auth = initInMemoryAuth();
			const userId = UserIdSchema.parse("google-user-123");

			const result = await auth.createGoogleUser({ email: "google@example.com", userId });

			expect(result).toEqual({ ok: true, userId });
			const lookup = await auth.findUserByEmail("google@example.com");
			expect(lookup).toEqual({ userId, emailVerified: true });
		});

		it("should reject duplicate email", async () => {
			const auth = initInMemoryAuth();
			await auth.createUser({ email: "test@example.com", password: "password123" });

			const result = await auth.createGoogleUser({
				email: "test@example.com",
				userId: UserIdSchema.parse("other-id"),
			});

			expect(result).toEqual({ ok: false, reason: "email-already-exists" });
		});

		it("should normalize email case", async () => {
			const auth = initInMemoryAuth();
			await auth.createGoogleUser({
				email: "Google@Example.COM",
				userId: UserIdSchema.parse("google-user-1"),
			});

			const result = await auth.createGoogleUser({
				email: "google@example.com",
				userId: UserIdSchema.parse("google-user-2"),
			});

			expect(result).toEqual({ ok: false, reason: "email-already-exists" });
		});

		it("should produce a user that cannot log in with any password", async () => {
			const auth = initInMemoryAuth();
			await auth.createGoogleUser({
				email: "google-only@example.com",
				userId: UserIdSchema.parse("google-user-only"),
			});

			const result = await auth.verifyCredentials({
				email: "google-only@example.com",
				password: "any-password",
			});

			expect(result).toEqual({ ok: false, reason: "invalid-credentials" });
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
