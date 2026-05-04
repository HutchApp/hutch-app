import { SaveArticleInputSchema } from "../article/article.schema";
import { MAX_URLS_PER_IMPORT } from "./import-session.schema";

export interface ExtractUrlsResult {
	readonly urls: readonly string[];
	readonly truncated: boolean;
	readonly totalFoundInFile: number;
}

const URL_REGEX = /\bhttps?:\/\/[^\s<>"'()[\]{}|\\^`]+/gi;
const TRAILING_PUNCTUATION = /[.,;:!?>'"\])]+$/;
const EMPTY: ExtractUrlsResult = { urls: [], truncated: false, totalFoundInFile: 0 };

function decodeBuffer(buffer: Buffer): string {
	const utf8 = buffer.toString("utf8");
	if (utf8.includes("�")) {
		return buffer.toString("latin1");
	}
	return utf8;
}

function hasPathOrQueryOrHash(parsed: URL): boolean {
	if (parsed.pathname !== "/") return true;
	if (parsed.search) return true;
	if (parsed.hash) return true;
	return false;
}

function normalizeUrl(url: string): string {
	const parsed = new URL(url);
	parsed.hostname = parsed.hostname.toLowerCase();
	if (hasPathOrQueryOrHash(parsed)) return parsed.toString();
	return `${parsed.protocol}//${parsed.host}`;
}

export function extractUrls(buffer: Buffer): ExtractUrlsResult {
	const text = decodeBuffer(buffer);
	const matches = text.match(URL_REGEX);
	if (!matches) return EMPTY;

	const seen = new Set<string>();
	const urls: string[] = [];
	let truncated = false;

	for (const raw of matches) {
		const stripped = raw.replace(TRAILING_PUNCTUATION, "");

		const parsed = SaveArticleInputSchema.safeParse({ url: stripped });
		if (!parsed.success) continue;

		const normalized = normalizeUrl(parsed.data.url);
		if (seen.has(normalized)) continue;
		seen.add(normalized);

		if (urls.length >= MAX_URLS_PER_IMPORT) {
			truncated = true;
			continue;
		}
		urls.push(parsed.data.url);
	}

	return { urls, truncated, totalFoundInFile: seen.size };
}
