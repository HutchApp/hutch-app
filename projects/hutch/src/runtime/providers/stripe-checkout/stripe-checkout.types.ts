/* c8 ignore start -- type-only file, no runtime code */
export type CheckoutSessionId = string & { readonly __brand: "CheckoutSessionId" };

export interface CheckoutSession {
	id: CheckoutSessionId;
	url: string;
}

export type CreateCheckoutSession = (params: {
	customerEmail: string;
	successUrl: string;
	cancelUrl: string;
}) => Promise<CheckoutSession>;

export type RetrieveCheckoutSession = (id: CheckoutSessionId) => Promise<
	| { ok: true; paid: boolean; customerEmail: string }
	| { ok: false; reason: "not-found" }
>;
/* c8 ignore stop */
