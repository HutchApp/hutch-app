import type { Minutes } from "./article.types";

const WORDS_PER_MINUTE = 238;

export function calculateReadTime(wordCount: number): Minutes {
	if (wordCount <= 0) {
		return 1 as Minutes;
	}
	return Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE)) as Minutes;
}
