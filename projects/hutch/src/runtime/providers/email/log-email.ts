import type { SendEmail } from "./email.types";

export function initLogEmail(): { sendEmail: SendEmail } {
	const sendEmail: SendEmail = async (message) => {
		console.log("[Email]", {
			from: message.from,
			to: message.to,
			bcc: message.bcc,
			subject: message.subject,
			html: message.html,
		});
	};

	return { sendEmail };
}
