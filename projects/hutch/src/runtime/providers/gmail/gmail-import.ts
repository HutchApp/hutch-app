import type { UserId } from "../../domain/user/user.types";
import type { GmailImportResult, QualifyLink } from "../../domain/gmail-import/gmail-import.types";
import { formatImportLabelName } from "../../domain/gmail-import/gmail-import.types";
import type { SaveArticle } from "../article-store/article-store.types";
import type { ParseArticle } from "../article-parser/article-parser.types";
import { extractLinks } from "../../domain/gmail-import/extract-links";
import { calculateReadTime } from "../../domain/article/estimated-read-time";
import type {
	GetGmailMessage,
	EnsureGmailLabel,
	LabelGmailMessage,
	GmailMessagePart,
} from "./gmail-api.types";
import type { EnsureValidAccessToken } from "./ensure-valid-access-token";

interface GmailImportDependencies {
	getGmailMessage: GetGmailMessage;
	ensureGmailLabel: EnsureGmailLabel;
	labelGmailMessage: LabelGmailMessage;
	ensureValidAccessToken: EnsureValidAccessToken;
	saveArticle: SaveArticle;
	parseArticle: ParseArticle;
	qualifyLink: QualifyLink;
	logError: (message: string, error?: Error) => void;
}

function decodeBase64Url(data: string): string {
	const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
	return Buffer.from(base64, "base64").toString("utf-8");
}

function extractHtmlBody(part: GmailMessagePart): string | undefined {
	if (part.mimeType === "text/html" && part.body.data) {
		return decodeBase64Url(part.body.data);
	}

	if (part.parts) {
		for (const child of part.parts) {
			const html = extractHtmlBody(child);
			if (html) return html;
		}
	}

	return undefined;
}

function extractTextBody(part: GmailMessagePart): string | undefined {
	if (part.mimeType === "text/plain" && part.body.data) {
		return decodeBase64Url(part.body.data);
	}

	if (part.parts) {
		for (const child of part.parts) {
			const text = extractTextBody(child);
			if (text) return text;
		}
	}

	return undefined;
}

export function initGmailImport(deps: GmailImportDependencies): {
	runGmailImport: (params: { userId: UserId; messageIds: string[] }) => Promise<GmailImportResult>;
} {
	const runGmailImport = async ({ userId, messageIds }: { userId: UserId; messageIds: string[] }): Promise<GmailImportResult> => {
		const result: GmailImportResult = {
			importedCount: 0,
			skippedCount: 0,
			emailsProcessed: 0,
			emailsLabeled: 0,
		};

		const accessToken = await deps.ensureValidAccessToken(userId);
		if (!accessToken) {
			deps.logError("Gmail import: no tokens found for user");
			return result;
		}

		const labelName = formatImportLabelName(new Date());
		const labelId = await deps.ensureGmailLabel({
			accessToken,
			labelName,
		});

		for (const messageId of messageIds) {
			const message = await deps.getGmailMessage({
				accessToken,
				messageId,
			});

			result.emailsProcessed++;

			const htmlBody = extractHtmlBody(message.payload);
			const textBody = extractTextBody(message.payload);
			const bodyContent = htmlBody ?? (textBody ? `<html><body>${textBody}</body></html>` : undefined);

			if (!bodyContent) continue;

			const links = extractLinks(bodyContent);

			for (const link of links) {
				const qualified = deps.qualifyLink(link);
				if (!qualified.ok) {
					result.skippedCount++;
					continue;
				}

				const parseResult = await deps.parseArticle(qualified.url);

				if (parseResult.ok) {
					await deps.saveArticle({
						userId,
						url: qualified.url,
						metadata: {
							title: parseResult.article.title,
							siteName: parseResult.article.siteName,
							excerpt: parseResult.article.excerpt,
							wordCount: parseResult.article.wordCount,
							imageUrl: parseResult.article.imageUrl,
						},
						content: parseResult.article.content || undefined,
						estimatedReadTime: calculateReadTime(parseResult.article.wordCount),
					});
					result.importedCount++;
				} else {
					result.skippedCount++;
				}
			}

			await deps.labelGmailMessage({
				accessToken,
				messageId,
				labelId,
			});
			result.emailsLabeled++;
		}

		return result;
	};

	return { runGmailImport };
}
