import assert from "node:assert/strict";
import type { SuperTest, Test } from "supertest";
import request from "supertest";
import type { Express } from "express";
import { CheckoutSessionIdSchema } from "../../../providers/stripe-checkout/stripe-checkout.schema";
import type { CheckoutSessionId } from "../../../providers/stripe-checkout/stripe-checkout.types";

interface StripeBundle {
	markPaid: (id: CheckoutSessionId) => void;
}

/** Drives an email-signup flow through the Stripe checkout boundary in a single
 * step: posts to /signup, asserts the redirect to the Stripe URL, marks the
 * session paid via the in-memory Stripe fake, then GETs the success URL using
 * the shared agent so the session cookie persists. */
export async function completeStripeSignup(params: {
	app: Express;
	stripe: StripeBundle;
	email: string;
	password: string;
	returnUrl?: string;
	agent?: SuperTest<Test>;
}): Promise<{
	signupResponse: import("supertest").Response;
	successResponse: import("supertest").Response;
	checkoutSessionId: CheckoutSessionId;
}> {
	const agent = params.agent ?? request.agent(params.app);
	const signupPath = params.returnUrl
		? `/signup?return=${encodeURIComponent(params.returnUrl)}`
		: "/signup";
	const signupResponse = await agent
		.post(signupPath)
		.type("form")
		.send({
			email: params.email,
			password: params.password,
			confirmPassword: params.password,
		});

	assert.equal(signupResponse.status, 303, "signup should redirect to Stripe");
	const stripeUrl = signupResponse.headers.location;
	assert(stripeUrl?.startsWith("https://checkout.stripe.test/"), `unexpected redirect: ${stripeUrl}`);
	const checkoutSessionId = CheckoutSessionIdSchema.parse(
		new URL(stripeUrl).pathname.replace(/^\//, ""),
	);

	params.stripe.markPaid(checkoutSessionId);

	const successResponse = await agent.get(
		`/auth/checkout/success?session_id=${encodeURIComponent(checkoutSessionId)}`,
	);
	return { signupResponse, successResponse, checkoutSessionId };
}
