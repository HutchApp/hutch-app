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

export function initClaudeSummarizer(deps: {
	createMessage: CreateAiMessage;
	findCachedSummary: FindCachedSummary;
	saveCachedSummary: SaveCachedSummary;
	logError: (message: string, error?: Error) => void;
	cleanContent: (html: string) => string;
}): { summarizeArticle: SummarizeArticle } {
	const summarizeArticle: SummarizeArticle = async (params) => {
		const cached = await deps.findCachedSummary(params.url);
		if (cached) return cached;

		const cleanedContent = deps.cleanContent(params.textContent);

		try {
			const response = await deps.createMessage({
				model: "claude-sonnet-4-6",
				max_tokens: 20480,
				system: SUMMARIZE_PROMPT,
				messages: [{ role: "user", content: cleanedContent }],
			});

			const textBlock = response.content.find(
				(block) => block.type === "text",
			);
			if (!textBlock || textBlock.type !== "text" || !textBlock.text) return null;

			const summary = textBlock.text.trim();
			if (summary === "Summary not available.") return null;

			await deps.saveCachedSummary({
				url: params.url,
				summary,
				inputTokens: response.usage.input_tokens,
				outputTokens: response.usage.output_tokens,
			});
			return summary;
		} catch (error) {
			deps.logError("Failed to summarize article", error instanceof Error ? error : undefined);
			return null;
		}
	};

	return { summarizeArticle };
}
