import type { GeneratedSummary } from "./article-summary.types";

export function pickExcerpt(
	summary: GeneratedSummary | undefined,
	fallback: string,
): string {
	return summary?.status === "ready" ? summary.summary : fallback;
}

const SEO_DESCRIPTION_MAX_CHARS = 160;

export function truncateForSeo(
	text: string,
	maxChars: number = SEO_DESCRIPTION_MAX_CHARS,
): string {
	if (text.length <= maxChars) return text;
	const slice = text.slice(0, maxChars - 1);
	const lastSpace = slice.lastIndexOf(" ");
	const cut = lastSpace > 0 ? slice.slice(0, lastSpace) : slice;
	return `${cut.trimEnd()}…`;
}
