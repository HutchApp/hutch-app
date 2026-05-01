import { isSaveableUrl, SaveArticleInputSchema } from "../article/article.schema";
import { MAX_URLS_PER_IMPORT } from "./import-session.schema";

export interface ExtractUrlsResult {
	readonly urls: readonly string[];
	readonly truncated: boolean;
}

const URL_REGEX = /\bhttps?:\/\/[^\s<>"'()[\]{}|\\^`]+/gi;
const TRAILING_PUNCTUATION = /[.,;:!?>'"\])]+$/;

function decodeBuffer(buffer: Buffer): string {
	const utf8 = buffer.toString("utf8");
	if (utf8.includes("�")) {
		return buffer.toString("latin1");
	}
	return utf8;
}

function normalizeUrl(url: string): string {
	// SaveArticleInputSchema has already accepted this URL, so URL() won't throw.
	const parsed = new URL(url);
	parsed.hostname = parsed.hostname.toLowerCase();
	const isPathOnly = parsed.pathname === "/" && !parsed.search && !parsed.hash;
	return isPathOnly ? `${parsed.protocol}//${parsed.host}` : parsed.toString();
}

export function extractUrls(buffer: Buffer): ExtractUrlsResult {
	const text = decodeBuffer(buffer);
	const matches = text.match(URL_REGEX) ?? [];
	const seen = new Set<string>();
	const urls: string[] = [];
	let truncated = false;

	for (const raw of matches) {
		const stripped = raw.replace(TRAILING_PUNCTUATION, "");
		if (!stripped) continue;

		const parsed = SaveArticleInputSchema.safeParse({ url: stripped });
		if (!parsed.success) continue;
		if (!isSaveableUrl(parsed.data.url)) continue;

		const normalized = normalizeUrl(parsed.data.url);
		if (seen.has(normalized)) continue;
		seen.add(normalized);

		if (urls.length >= MAX_URLS_PER_IMPORT) {
			truncated = true;
			break;
		}
		urls.push(parsed.data.url);
	}

	return { urls, truncated };
}
