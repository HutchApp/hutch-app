import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { HutchLogger } from "@packages/hutch-logger";
import type {
	CreateChatCompletion,
	FindCachedSummary,
	SaveCachedSummary,
	SummarizeArticle,
} from "./article-summary.types";

const SUMMARIZE_PROMPT = readFileSync(
	join(__dirname, "summarize-prompt.md"),
	"utf-8",
);

export function initDeepseekSummarizer(deps: {
	createChatCompletion: CreateChatCompletion;
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

		deps.logger.info("[summarize] cache miss, calling DeepSeek", { url: params.url });
		const cleanedContent = deps.cleanContent(params.textContent);

		try {
			const response = await deps.createChatCompletion({
				model: "deepseek-chat",
				max_tokens: 8192,
				messages: [
					{ role: "system", content: SUMMARIZE_PROMPT },
					{ role: "user", content: cleanedContent },
				],
			});

			const summary = response.content?.trim() ?? "";
			if (!summary || summary === "Summary not available.") {
				deps.logger.info("[summarize] DeepSeek returned unavailable", { url: params.url });
				return null;
			}

			await deps.saveCachedSummary({
				url: params.url,
				summary,
				inputTokens: response.usage.prompt_tokens,
				outputTokens: response.usage.completion_tokens,
			});
			deps.logger.info("[summarize] saved", { url: params.url, inputTokens: response.usage.prompt_tokens, outputTokens: response.usage.completion_tokens });
			return summary;
		} catch (error) {
			deps.logger.error("[summarize] failed to summarize article", error instanceof Error ? error : undefined);
			return null;
		}
	};

	return { summarizeArticle };
}
