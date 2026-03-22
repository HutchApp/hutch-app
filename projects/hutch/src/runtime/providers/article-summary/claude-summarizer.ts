import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
	CreateAiMessage,
	FindCachedSummary,
	SaveCachedSummary,
	SummarizeArticle,
} from "./article-summary.types";

const SUMMARIZE_PROMPT = readFileSync(
	join(__dirname, "summarize-prompt.md"),
	"utf-8",
);

const MAX_CONTENT_LENGTH = 20_000;

export function initClaudeSummarizer(deps: {
	createMessage: CreateAiMessage;
	findCachedSummary: FindCachedSummary;
	saveCachedSummary: SaveCachedSummary;
	logError: (message: string, error?: Error) => void;
}): { summarizeArticle: SummarizeArticle } {
	const summarizeArticle: SummarizeArticle = async (params) => {
		const cached = await deps.findCachedSummary(params.url);
		if (cached) return cached;

		const truncatedContent = params.textContent.slice(0, MAX_CONTENT_LENGTH);

		try {
			const response = await deps.createMessage({
				model: "claude-sonnet-4-6-20250514",
				max_tokens: 300,
				system: SUMMARIZE_PROMPT,
				messages: [{ role: "user", content: truncatedContent }],
			});

			const textBlock = response.content.find(
				(block) => block.type === "text",
			);
			if (!textBlock || textBlock.type !== "text" || !textBlock.text) return null;

			const summary = textBlock.text.trim();
			if (summary === "Summary not available.") return null;

			await deps.saveCachedSummary({ url: params.url, summary });
			return summary;
		} catch (error) {
			deps.logError("Failed to summarize article", error instanceof Error ? error : undefined);
			return null;
		}
	};

	return { summarizeArticle };
}
