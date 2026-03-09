import type { SendEmail } from "./email.types";

export function initLogEmail(): { sendEmail: SendEmail } {
	const sendEmail: SendEmail = async (message) => {
		console.log("[email] To:", message.to);
		console.log("[email] Subject:", message.subject);
		console.log("[email] Body:", message.html);
	};

	return { sendEmail };
}
