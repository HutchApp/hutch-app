import assert from "node:assert/strict";
import { UserIdSchema } from "../../domain/user/user.schema";
import { CheckoutSessionIdSchema } from "../stripe-checkout/stripe-checkout.schema";
import { initInMemoryPendingSignup } from "./in-memory-pending-signup";

describe("initInMemoryPendingSignup", () => {
	it("returns null for an unknown checkout session", async () => {
		const { consumePendingSignup } = initInMemoryPendingSignup();
		const result = await consumePendingSignup(CheckoutSessionIdSchema.parse("cs_test_unknown"));
		expect(result).toBeNull();
	});

	it("returns the stored email signup once and then null", async () => {
		const { storePendingSignup, consumePendingSignup } = initInMemoryPendingSignup();
		const checkoutSessionId = CheckoutSessionIdSchema.parse("cs_test_email");
		await storePendingSignup({
			checkoutSessionId,
			signup: { method: "email", email: "buyer@example.com", passwordHash: "hash:hex" },
		});

		const first = await consumePendingSignup(checkoutSessionId);
		assert(first, "first consume should return the stored signup");
		expect(first.method).toBe("email");
		if (first.method === "email") {
			expect(first.email).toBe("buyer@example.com");
			expect(first.passwordHash).toBe("hash:hex");
		}

		const second = await consumePendingSignup(checkoutSessionId);
		expect(second).toBeNull();
	});

	it("returns the stored google signup once and then null", async () => {
		const { storePendingSignup, consumePendingSignup } = initInMemoryPendingSignup();
		const checkoutSessionId = CheckoutSessionIdSchema.parse("cs_test_google");
		const userId = UserIdSchema.parse("u-google-123");
		await storePendingSignup({
			checkoutSessionId,
			signup: { method: "google", email: "google@example.com", userId, returnUrl: "/save" },
		});

		const first = await consumePendingSignup(checkoutSessionId);
		assert(first, "first consume should return the stored google signup");
		expect(first.method).toBe("google");
		if (first.method === "google") {
			expect(first.email).toBe("google@example.com");
			expect(first.userId).toBe(userId);
			expect(first.returnUrl).toBe("/save");
		}

		const second = await consumePendingSignup(checkoutSessionId);
		expect(second).toBeNull();
	});
});
