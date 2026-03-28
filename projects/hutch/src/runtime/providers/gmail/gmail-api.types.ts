import type { GmailTokens } from "../../domain/gmail-import/gmail-import.types";

export interface GmailMessageRef {
	id: string;
	threadId: string;
}

export interface GmailMessageListResponse {
	messages?: GmailMessageRef[];
	nextPageToken?: string;
	resultSizeEstimate: number;
}

export interface GmailMessagePart {
	mimeType: string;
	body: { data?: string; size: number };
	parts?: GmailMessagePart[];
}

export interface GmailMessage {
	id: string;
	threadId: string;
	labelIds: string[];
	payload: GmailMessagePart;
}

export interface GmailLabel {
	id: string;
	name: string;
	type: "system" | "user";
}

export interface GmailLabelListResponse {
	labels: GmailLabel[];
}

export type ExchangeGmailCode = (params: {
	code: string;
	redirectUri: string;
}) => Promise<GmailTokens>;

export type RefreshGmailAccessToken = (params: {
	refreshToken: string;
}) => Promise<GmailTokens>;

export type ListGmailMessages = (params: {
	accessToken: string;
	pageToken?: string;
}) => Promise<GmailMessageListResponse>;

export type GetGmailMessage = (params: {
	accessToken: string;
	messageId: string;
}) => Promise<GmailMessage>;

export type EnsureGmailLabel = (params: {
	accessToken: string;
	labelName: string;
}) => Promise<string>;

export type LabelGmailMessage = (params: {
	accessToken: string;
	messageId: string;
	labelId: string;
}) => Promise<void>;

export interface GmailEmailPreview {
	messageId: string;
	subject: string;
	from: string;
}

export type ListUnreadGmailMessages = (params: {
	accessToken: string;
}) => Promise<GmailEmailPreview[]>;
