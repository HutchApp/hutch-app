import { Resend } from "resend";
import type { SendEmail } from "./email.types";

export function initResendEmail(apiKey: string): { sendEmail: SendEmail } {
	const resend = new Resend(apiKey);

	const sendEmail: SendEmail = async (message) => {
		await resend.emails.send({
			from: message.from,
			to: message.to,
			subject: message.subject,
			html: message.html,
			...(message.bcc && { bcc: message.bcc }),
		});
	};

	return { sendEmail };
}
