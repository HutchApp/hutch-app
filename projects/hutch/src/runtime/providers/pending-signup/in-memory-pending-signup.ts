import type { CheckoutSessionId } from "../stripe-checkout/stripe-checkout.types";
import type {
	ConsumePendingSignup,
	ListAllPendingSignups,
	MarkPendingSignupRecoveryEmailSent,
	PendingSignup,
	StorePendingSignup,
} from "./pending-signup.types";

interface StoredEntry {
	signup: PendingSignup;
	recoveryEmailSentAt?: number;
}

export function initInMemoryPendingSignup(): {
	storePendingSignup: StorePendingSignup;
	consumePendingSignup: ConsumePendingSignup;
	listAllPendingSignups: ListAllPendingSignups;
	markPendingSignupRecoveryEmailSent: MarkPendingSignupRecoveryEmailSent;
} {
	const store = new Map<CheckoutSessionId, StoredEntry>();

	const storePendingSignup: StorePendingSignup = async ({ checkoutSessionId, signup }) => {
		store.set(checkoutSessionId, { signup });
	};

	const consumePendingSignup: ConsumePendingSignup = async (checkoutSessionId) => {
		const entry = store.get(checkoutSessionId);
		if (!entry) return null;
		store.delete(checkoutSessionId);
		return entry.signup;
	};

	const listAllPendingSignups: ListAllPendingSignups = async () =>
		Array.from(store.entries()).map(([checkoutSessionId, entry]) => ({
			checkoutSessionId,
			email: entry.signup.email,
			method: entry.signup.method,
			...(entry.recoveryEmailSentAt !== undefined
				? { recoveryEmailSentAt: entry.recoveryEmailSentAt }
				: {}),
		}));

	const markPendingSignupRecoveryEmailSent: MarkPendingSignupRecoveryEmailSent = async ({
		checkoutSessionId,
		sentAt,
	}) => {
		const entry = store.get(checkoutSessionId);
		if (!entry) throw new Error(`No pending signup: ${checkoutSessionId}`);
		entry.recoveryEmailSentAt = sentAt;
	};

	return {
		storePendingSignup,
		consumePendingSignup,
		listAllPendingSignups,
		markPendingSignupRecoveryEmailSent,
	};
}
