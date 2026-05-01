/* c8 ignore start -- thin AWS SDK wrapper, tested via integration */
import {
	type DynamoDBDocumentClient,
	defineDynamoTable,
	dynamoField,
} from "@packages/hutch-storage-client";
import { z } from "zod";
import { UserIdSchema } from "../../domain/user/user.schema";
import { CheckoutSessionIdSchema } from "../stripe-checkout/stripe-checkout.schema";
import type {
	ConsumePendingSignup,
	PendingSignup,
	StorePendingSignup,
} from "./pending-signup.types";

/** Pending signups expire after 1 hour — Stripe checkout sessions live for 24h but
 * we don't want to keep abandoned hashed passwords any longer than necessary. */
const TTL_SECONDS = 60 * 60;

const PendingSignupRow = z.object({
	checkoutSessionId: CheckoutSessionIdSchema,
	method: z.enum(["email", "google"]),
	email: z.string(),
	passwordHash: dynamoField(z.string()),
	userId: dynamoField(UserIdSchema),
	returnUrl: dynamoField(z.string()),
	expiresAt: z.number(),
});

export function initDynamoDbPendingSignup(deps: {
	client: DynamoDBDocumentClient;
	tableName: string;
}): {
	storePendingSignup: StorePendingSignup;
	consumePendingSignup: ConsumePendingSignup;
} {
	const table = defineDynamoTable({
		client: deps.client,
		tableName: deps.tableName,
		schema: PendingSignupRow,
	});

	const storePendingSignup: StorePendingSignup = async ({ checkoutSessionId, signup }) => {
		const expiresAt = Math.floor(Date.now() / 1000) + TTL_SECONDS;
		await table.put({
			Item: {
				checkoutSessionId,
				method: signup.method,
				email: signup.email,
				...(signup.method === "email" ? { passwordHash: signup.passwordHash } : {}),
				...(signup.method === "google" ? { userId: signup.userId } : {}),
				...(signup.returnUrl ? { returnUrl: signup.returnUrl } : {}),
				expiresAt,
			},
		});
	};

	const consumePendingSignup: ConsumePendingSignup = async (checkoutSessionId) => {
		const { Attributes } = await table.delete({
			Key: { checkoutSessionId },
			ReturnValues: "ALL_OLD",
		});
		if (!Attributes) return null;
		if (Attributes.expiresAt < Math.floor(Date.now() / 1000)) return null;

		const returnUrl = Attributes.returnUrl ?? undefined;
		if (Attributes.method === "email") {
			const passwordHash = Attributes.passwordHash;
			if (!passwordHash) return null;
			const signup: PendingSignup = {
				method: "email",
				email: Attributes.email,
				passwordHash,
				...(returnUrl ? { returnUrl } : {}),
			};
			return signup;
		}

		const userId = Attributes.userId;
		if (!userId) return null;
		const signup: PendingSignup = {
			method: "google",
			email: Attributes.email,
			userId,
			...(returnUrl ? { returnUrl } : {}),
		};
		return signup;
	};

	return { storePendingSignup, consumePendingSignup };
}
/* c8 ignore stop */
