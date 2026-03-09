import { Resend } from "resend";
import type { SendEmail } from "./email.types";

export function initResendEmail(deps: {
	apiKey: string;
	fromAddress: string;
}): { sendEmail: SendEmail } {
	const resend = new Resend(deps.apiKey);

	const sendEmail: SendEmail = async (message) => {
		await resend.emails.send({
			from: deps.fromAddress,
			to: message.to,
			subject: message.subject,
			html: message.html,
		});
	};

	return { sendEmail };
}
