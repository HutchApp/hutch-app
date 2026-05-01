import { z } from "zod";
import type { CheckoutSessionId } from "./stripe-checkout.types";

export const CheckoutSessionIdSchema = z
	.string()
	.min(1)
	.transform((s): CheckoutSessionId => s as CheckoutSessionId);
