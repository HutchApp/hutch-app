export interface EmailMessage {
	from: string;
	to: string;
	bcc?: string;
	subject: string;
	html: string;
}

export type SendEmail = (message: EmailMessage) => Promise<void>;
