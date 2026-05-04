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

const PendingSignupRow = z.object({
	checkoutSessionId: CheckoutSessionIdSchema,
	method: z.enum(["email", "google"]),
	email: z.string(),
	passwordHash: dynamoField(z.string()),
	userId: dynamoField(UserIdSchema),
	returnUrl: dynamoField(z.string()),
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
		await table.put({
			Item: {
				checkoutSessionId,
				method: signup.method,
				email: signup.email,
				...(signup.method === "email" ? { passwordHash: signup.passwordHash } : {}),
				...(signup.method === "google" ? { userId: signup.userId } : {}),
				...(signup.returnUrl ? { returnUrl: signup.returnUrl } : {})
			},
		});
	};

	const consumePendingSignup: ConsumePendingSignup = async (checkoutSessionId) => {
		const { Attributes } = await table.delete({
			Key: { checkoutSessionId },
			ReturnValues: "ALL_OLD",
		});
		if (!Attributes) return null;

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
