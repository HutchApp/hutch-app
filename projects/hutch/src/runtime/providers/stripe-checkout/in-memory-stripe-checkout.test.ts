import assert from "node:assert/strict";
import { initInMemoryStripeCheckout } from "./in-memory-stripe-checkout";
import { CheckoutSessionIdSchema } from "./stripe-checkout.schema";

describe("initInMemoryStripeCheckout", () => {
	it("returns a checkout URL containing the success URL", async () => {
		const stripe = initInMemoryStripeCheckout();

		const session = await stripe.createCheckoutSession({
			customerEmail: "test@example.com",
			successUrl: "https://app.test/auth/checkout/success?session_id={CHECKOUT_SESSION_ID}",
			cancelUrl: "https://app.test/signup",
		});

		expect(session.id).toMatch(/^cs_test_/);
		expect(session.url).toContain("https://checkout.stripe.test/");
		expect(session.url).toContain(encodeURIComponent("https://app.test/auth/checkout/success"));
		expect(stripe.getCheckoutUrl(session.id)).toBe(session.url);
	});

	it("uses custom checkoutBaseUrl when provided", async () => {
		const stripe = initInMemoryStripeCheckout({ checkoutBaseUrl: "http://localhost:9999/e2e/stripe-checkout" });

		const session = await stripe.createCheckoutSession({
			customerEmail: "test@example.com",
			successUrl: "http://localhost:9999/auth/checkout/success?session_id={CHECKOUT_SESSION_ID}",
			cancelUrl: "http://localhost:9999/signup",
		});

		expect(session.url).toContain("http://localhost:9999/e2e/stripe-checkout/");
		expect(session.url).not.toContain("checkout.stripe.test");
	});

	it("returns unpaid status until markPaid is called", async () => {
		const stripe = initInMemoryStripeCheckout();
		const session = await stripe.createCheckoutSession({
			customerEmail: "buyer@example.com",
			successUrl: "https://app.test/ok",
			cancelUrl: "https://app.test/cancel",
		});

		const before = await stripe.retrieveCheckoutSession(session.id);
		assert.equal(before.ok, true);
		if (before.ok) {
			expect(before.paid).toBe(false);
			expect(before.customerEmail).toBe("buyer@example.com");
		}

		stripe.markPaid(session.id);

		const after = await stripe.retrieveCheckoutSession(session.id);
		assert.equal(after.ok, true);
		if (after.ok) expect(after.paid).toBe(true);
	});

	it("returns not-found when retrieving an unknown session", async () => {
		const stripe = initInMemoryStripeCheckout();
		const result = await stripe.retrieveCheckoutSession(
			CheckoutSessionIdSchema.parse("cs_test_unknown"),
		);
		expect(result).toEqual({ ok: false, reason: "not-found" });
	});

	it("throws when marking an unknown session as paid", () => {
		const stripe = initInMemoryStripeCheckout();
		expect(() => stripe.markPaid(CheckoutSessionIdSchema.parse("cs_test_missing"))).toThrow(
			/No checkout session/,
		);
	});

	it("throws when looking up the URL of an unknown session", () => {
		const stripe = initInMemoryStripeCheckout();
		expect(() => stripe.getCheckoutUrl(CheckoutSessionIdSchema.parse("cs_test_missing"))).toThrow(
			/No checkout URL/,
		);
	});
});
