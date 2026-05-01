/* c8 ignore start -- type-only file, no runtime code */
import type { UserId } from "../../domain/user/user.types";
import type { CheckoutSessionId } from "../stripe-checkout/stripe-checkout.types";

export type PendingSignup =
	| { method: "email"; email: string; passwordHash: string; returnUrl?: string }
	| { method: "google"; email: string; userId: UserId; returnUrl?: string };

export type StorePendingSignup = (params: {
	checkoutSessionId: CheckoutSessionId;
	signup: PendingSignup;
}) => Promise<void>;

export type ConsumePendingSignup = (
	checkoutSessionId: CheckoutSessionId,
) => Promise<PendingSignup | null>;
/* c8 ignore stop */
