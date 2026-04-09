import type { GmailEmailPreview } from "../../../providers/gmail/gmail-api.types";

export interface GmailImportViewModel {
	isConnected: boolean;
	statusMessage?: string;
	emails: GmailEmailPreview[];
	emailCount: number;
}

export function toGmailImportViewModel(params: {
	isConnected: boolean;
	statusMessage?: string;
	emails: GmailEmailPreview[];
}): GmailImportViewModel {
	return {
		isConnected: params.isConnected,
		statusMessage: params.statusMessage,
		emails: params.emails,
		emailCount: params.emails.length,
	};
}
