import type { UserId } from "../user/user.types";

export interface GmailTokens {
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
}

export interface GmailImportResult {
	importedCount: number;
	skippedCount: number;
	emailsProcessed: number;
	emailsLabeled: number;
}

export type QualifyLinkResult =
	| { ok: true; url: string }
	| { ok: false; reason: string };

export type QualifyLink = (url: string) => QualifyLinkResult;

export type RunGmailImport = (params: {
	userId: UserId;
	messageIds: string[];
}) => Promise<GmailImportResult>;

export function formatImportLabelName(date: Date): string {
	const day = String(date.getUTCDate()).padStart(2, "0");
	const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
	const month = months[date.getUTCMonth()];
	const year = String(date.getUTCFullYear()).slice(2);
	return `imported-by-hutch-${day}-${month}-${year}`;
}
