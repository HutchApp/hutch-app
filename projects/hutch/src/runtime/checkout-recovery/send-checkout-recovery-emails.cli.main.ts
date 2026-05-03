/* c8 ignore start -- composition root, no logic to test */
import { writeFile } from "node:fs/promises";
import { createDynamoDocumentClient } from "@packages/hutch-storage-client";
import { initDynamoDbPendingSignup } from "../providers/pending-signup/dynamodb-pending-signup";
import { initResendEmail } from "../providers/email/resend-email";
import { initStripeCheckout } from "../providers/stripe-checkout/stripe-checkout";
import { buildCheckoutRecoveryEmail } from "../web/auth/checkout-recovery-email";
import { getEnv, requireEnv } from "../require-env";
import { selectRecipients } from "./select-recipients";

async function main(): Promise<void> {
	const tableName = requireEnv("DYNAMODB_PENDING_SIGNUPS_TABLE");
	const stripeApiKey = requireEnv("STRIPE_SECRET_KEY");
	const stripePriceId = requireEnv("STRIPE_PRICE_ID");
	const resendApiKey = requireEnv("RESEND_API_KEY");
	const origin = requireEnv("READPLACE_ORIGIN");
	const from = requireEnv("RECOVERY_EMAIL_FROM");
	const replyTo = requireEnv("RECOVERY_EMAIL_REPLY_TO");
	const bcc = requireEnv("RECOVERY_EMAIL_BCC");
	const dryRun = requireEnv<"true" | "false">("RECOVERY_EMAIL_DRY_RUN") === "true";
	const reportPath = getEnv("RECOVERY_REPORT_PATH");

	const dynamoClient = createDynamoDocumentClient();
	const pendingSignup = initDynamoDbPendingSignup({ client: dynamoClient, tableName });
	const stripe = initStripeCheckout({
		apiKey: stripeApiKey,
		priceId: stripePriceId,
		fetch: globalThis.fetch,
	});
	const { sendEmail } = initResendEmail(resendApiKey);

	const founderAvatarUrl = `${origin}/fayner-brack.jpg`;

	console.log(`[recovery] Scanning ${tableName} for pending signups…`);
	const rows = await pendingSignup.listAllPendingSignups();
	console.log(`[recovery] Found ${rows.length} pending signup row(s).`);

	const { recipients, skipped } = await selectRecipients({
		now: new Date(),
		rows,
		retrieveCheckoutSession: stripe.retrieveCheckoutSession,
	});

	console.log(
		`[recovery] ${recipients.length} candidate(s), ${skipped.length} skipped.`,
	);
	for (const skip of skipped) {
		console.log(`[recovery]   skip ${skip.email} (${skip.reason})`);
	}

	let sent = 0;
	const errors: { email: string; error: string }[] = [];

	for (const recipient of recipients) {
		const resumeUrl = `${origin}/signup?email=${encodeURIComponent(recipient.email)}&utm_source=recovery`;
		const { html, text } = buildCheckoutRecoveryEmail({ founderAvatarUrl, resumeUrl });
		const message = {
			from,
			to: recipient.email,
			bcc,
			replyTo,
			subject: "Did something stop you?",
			html,
			text,
		};

		if (dryRun) {
			console.log(`[recovery] DRY RUN → would send to ${recipient.email}`);
			console.log(`[recovery]   resumeUrl=${resumeUrl}`);
			continue;
		}

		try {
			await sendEmail(message);
			await pendingSignup.markPendingSignupRecoveryEmailSent({
				checkoutSessionId: recipient.checkoutSessionId,
				sentAt: Math.floor(Date.now() / 1000),
			});
			sent++;
			console.log(`[recovery] sent → ${recipient.email}`);
		} catch (err) {
			const error = err instanceof Error ? err.message : String(err);
			errors.push({ email: recipient.email, error });
			console.error(`[recovery] FAILED → ${recipient.email}: ${error}`);
		}
	}

	if (reportPath !== undefined) {
		await writeFile(
			reportPath,
			`${JSON.stringify(
				{
					candidates: recipients.length,
					skipped,
					sent,
					errors,
					dryRun,
				},
				null,
				2,
			)}\n`,
			"utf8",
		);
	}

	console.log(
		`[recovery] Done. ${recipients.length} candidate(s), ${skipped.length} skipped, ${sent} sent, ${errors.length} error(s).`,
	);
}

main().catch((err) => {
	console.error("[recovery] Fatal:", err);
	process.exit(1);
});
/* c8 ignore stop */
