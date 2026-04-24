export const SELECT_CONTENT_SYSTEM_PROMPT = [
	"Pick the more complete article body for the given URL.",
	"Strong signals: coherent prose, paragraphs/headings, byline, dates.",
	'Anti-signals: "verify you are human", "loading…", sitemap/navigation-only',
	"content, boilerplate, off-topic chrome, error pages.",
	'Reply with strict JSON only — no prose, no code fences: {"winner": "A" | "B" | "tie", "reason": "<short>"}.',
].join(" ");

export type ContentSource = "tier-0" | "canonical";

export type SelectorCandidate = {
	source: ContentSource;
	title: string;
	wordCount: number;
	html: string;
};

export function buildSelectContentUserMessage(params: {
	url: string;
	candidates: [SelectorCandidate, SelectorCandidate];
}): string {
	const [a, b] = params.candidates;
	return [
		`URL: ${params.url}`,
		"",
		`--- A (source=${a.source}, title ${JSON.stringify(a.title)}, words ${a.wordCount}) ---`,
		a.html,
		"",
		`--- B (source=${b.source}, title ${JSON.stringify(b.title)}, words ${b.wordCount}) ---`,
		b.html,
	].join("\n");
}
