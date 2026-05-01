import type { CheckoutSessionId } from "../stripe-checkout/stripe-checkout.types";
import type {
	ConsumePendingSignup,
	PendingSignup,
	StorePendingSignup,
} from "./pending-signup.types";

export function initInMemoryPendingSignup(): {
	storePendingSignup: StorePendingSignup;
	consumePendingSignup: ConsumePendingSignup;
} {
	const store = new Map<CheckoutSessionId, PendingSignup>();

	const storePendingSignup: StorePendingSignup = async ({ checkoutSessionId, signup }) => {
		store.set(checkoutSessionId, signup);
	};

	const consumePendingSignup: ConsumePendingSignup = async (checkoutSessionId) => {
		const signup = store.get(checkoutSessionId);
		if (!signup) return null;
		store.delete(checkoutSessionId);
		return signup;
	};

	return { storePendingSignup, consumePendingSignup };
}
