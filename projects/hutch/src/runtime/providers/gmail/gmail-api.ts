import assert from "node:assert";
import { z } from "zod";
import type {
	ExchangeGmailCode,
	RefreshGmailAccessToken,
	ListGmailMessages,
	GetGmailMessage,
	EnsureGmailLabel,
	LabelGmailMessage,
	ListUnreadGmailMessages,
	GmailEmailPreview,
	GmailMessagePart,
} from "./gmail-api.types";

const TokenExchangeResponse = z.object({
	access_token: z.string(),
	refresh_token: z.string(),
	expires_in: z.number(),
});

const TokenRefreshResponse = z.object({
	access_token: z.string(),
	expires_in: z.number(),
});

const GmailMessageRefSchema = z.object({
	id: z.string(),
	threadId: z.string(),
});

const GmailMessagePartSchema: z.ZodType<GmailMessagePart> = z.object({
	mimeType: z.string(),
	body: z.object({ data: z.string().optional(), size: z.number() }),
	parts: z.lazy(() => GmailMessagePartSchema.array()).optional(),
});

const GmailMessageSchema = z.object({
	id: z.string(),
	threadId: z.string(),
	labelIds: z.array(z.string()),
	payload: GmailMessagePartSchema,
});

const GmailMessageListResponseSchema = z.object({
	messages: z.array(GmailMessageRefSchema).optional(),
	nextPageToken: z.string().optional(),
	resultSizeEstimate: z.number(),
});

const GmailLabelSchema = z.object({
	id: z.string(),
	name: z.string(),
	type: z.enum(["system", "user"]),
});

const GmailLabelListResponseSchema = z.object({
	labels: z.array(GmailLabelSchema),
});

const GmailMessageMetadataSchema = z.object({
	id: z.string(),
	payload: z.object({
		headers: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
	}),
});

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

interface GmailApiDependencies {
	fetch: typeof globalThis.fetch;
	clientId: string;
	clientSecret: string;
}

export function initGmailApi(deps: GmailApiDependencies): {
	exchangeGmailCode: ExchangeGmailCode;
	refreshGmailAccessToken: RefreshGmailAccessToken;
	listGmailMessages: ListGmailMessages;
	getGmailMessage: GetGmailMessage;
	ensureGmailLabel: EnsureGmailLabel;
	labelGmailMessage: LabelGmailMessage;
	listUnreadGmailMessages: ListUnreadGmailMessages;
} {
	const { fetch, clientId, clientSecret } = deps;

	const exchangeGmailCode: ExchangeGmailCode = async ({ code, redirectUri }) => {
		const response = await fetch(TOKEN_ENDPOINT, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				code,
				client_id: clientId,
				client_secret: clientSecret,
				redirect_uri: redirectUri,
				grant_type: "authorization_code",
			}),
		});

		assert(response.ok, `Gmail token exchange failed: ${response.status}`);
		const data = TokenExchangeResponse.parse(await response.json());

		return {
			accessToken: data.access_token,
			refreshToken: data.refresh_token,
			expiresAt: Date.now() + data.expires_in * 1000,
		};
	};

	const refreshGmailAccessToken: RefreshGmailAccessToken = async ({ refreshToken }) => {
		const response = await fetch(TOKEN_ENDPOINT, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				refresh_token: refreshToken,
				client_id: clientId,
				client_secret: clientSecret,
				grant_type: "refresh_token",
			}),
		});

		assert(response.ok, `Gmail token refresh failed: ${response.status}`);
		const data = TokenRefreshResponse.parse(await response.json());

		return {
			accessToken: data.access_token,
			refreshToken,
			expiresAt: Date.now() + data.expires_in * 1000,
		};
	};

	const listGmailMessages: ListGmailMessages = async ({ accessToken, pageToken }) => {
		const url = new URL(`${GMAIL_API_BASE}/messages`);
		url.searchParams.set("maxResults", "100");
		if (pageToken) url.searchParams.set("pageToken", pageToken);

		const response = await fetch(url.toString(), {
			headers: { Authorization: `Bearer ${accessToken}` },
		});

		assert(response.ok, `Gmail list messages failed: ${response.status}`);
		return GmailMessageListResponseSchema.parse(await response.json());
	};

	const getGmailMessage: GetGmailMessage = async ({ accessToken, messageId }) => {
		const url = `${GMAIL_API_BASE}/messages/${messageId}?format=full`;

		const response = await fetch(url, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});

		assert(response.ok, `Gmail get message failed: ${response.status}`);
		return GmailMessageSchema.parse(await response.json());
	};

	const ensureGmailLabel: EnsureGmailLabel = async ({ accessToken, labelName }) => {
		const listResponse = await fetch(`${GMAIL_API_BASE}/labels`, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});

		assert(listResponse.ok, `Gmail list labels failed: ${listResponse.status}`);
		const { labels } = GmailLabelListResponseSchema.parse(await listResponse.json());

		const existing = labels.find((l) => l.name === labelName);
		if (existing) return existing.id;

		const createResponse = await fetch(`${GMAIL_API_BASE}/labels`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ name: labelName }),
		});

		assert(createResponse.ok, `Gmail create label failed: ${createResponse.status}`);
		const created = GmailLabelSchema.parse(await createResponse.json());
		return created.id;
	};

	const labelGmailMessage: LabelGmailMessage = async ({ accessToken, messageId, labelId }) => {
		const response = await fetch(`${GMAIL_API_BASE}/messages/${messageId}/modify`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ addLabelIds: [labelId] }),
		});

		assert(response.ok, `Gmail label message failed: ${response.status}`);
	};

	const listUnreadGmailMessages: ListUnreadGmailMessages = async ({ accessToken }) => {
		const previews: GmailEmailPreview[] = [];
		let pageToken: string | undefined;

		do {
			const url = new URL(`${GMAIL_API_BASE}/messages`);
			url.searchParams.set("q", "is:unread in:inbox");
			url.searchParams.set("maxResults", "500");
			if (pageToken) url.searchParams.set("pageToken", pageToken);

			const listResponse = await fetch(url.toString(), {
				headers: { Authorization: `Bearer ${accessToken}` },
			});

			assert(listResponse.ok, `Gmail list unread messages failed: ${listResponse.status}`);
			const listData = GmailMessageListResponseSchema.parse(await listResponse.json());

			if (!listData.messages) break;

			const messagePreviews = await Promise.all(
				listData.messages.map(async (ref) => {
					const msgUrl = `${GMAIL_API_BASE}/messages/${ref.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`;
					const msgResponse = await fetch(msgUrl, {
						headers: { Authorization: `Bearer ${accessToken}` },
					});

					assert(msgResponse.ok, `Gmail get message metadata failed: ${msgResponse.status}`);
					const msg = GmailMessageMetadataSchema.parse(await msgResponse.json());

					const headers = msg.payload.headers ?? [];
					const subject = headers.find(h => h.name === "Subject")?.value ?? "(no subject)";
					const from = headers.find(h => h.name === "From")?.value ?? "(unknown sender)";

					return { messageId: ref.id, subject, from };
				})
			);
			previews.push(...messagePreviews);

			pageToken = listData.nextPageToken;
		} while (pageToken);

		return previews;
	};

	return {
		exchangeGmailCode,
		refreshGmailAccessToken,
		listGmailMessages,
		getGmailMessage,
		ensureGmailLabel,
		labelGmailMessage,
		listUnreadGmailMessages,
	};
}
