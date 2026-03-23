import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { HutchLogger } from "@packages/hutch-logger";
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
	logger: HutchLogger;
	cleanContent: (html: string) => string;
}): { summarizeArticle: SummarizeArticle } {
	const summarizeArticle: SummarizeArticle = async (params) => {
		deps.logger.info("[summarize] starting", { url: params.url });

		const cached = await deps.findCachedSummary(params.url);
		if (cached) {
			deps.logger.info("[summarize] cache hit", { url: params.url });
			return cached;
		}

		deps.logger.info("[summarize] cache miss, calling Claude", { url: params.url });
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
			if (!textBlock || textBlock.type !== "text" || !textBlock.text) {
				deps.logger.info("[summarize] no text block in response", { url: params.url });
				return null;
			}

			const summary = textBlock.text.trim();
			if (summary === "Summary not available.") {
				deps.logger.info("[summarize] Claude returned unavailable", { url: params.url });
				return null;
			}

			await deps.saveCachedSummary({
				url: params.url,
				summary,
				inputTokens: response.usage.input_tokens,
				outputTokens: response.usage.output_tokens,
			});
			deps.logger.info("[summarize] saved", { url: params.url, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens });
			return summary;
		} catch (error) {
			deps.logger.error("[summarize] failed to summarize article", error instanceof Error ? error : undefined);
			return null;
		}
	};

	return { summarizeArticle };
}
