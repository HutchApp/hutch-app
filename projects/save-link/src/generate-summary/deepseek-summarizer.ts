import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { HutchLogger } from "@packages/hutch-logger";
import type {
	CreateChatCompletion,
	FindCachedSummary,
	SaveCachedSummary,
	SummarizeArticle,
} from "./article-summary.types";
import { MAX_SUMMARY_LENGTH } from "./max-summary-length";

const SUMMARIZE_PROMPT = readFileSync(
	join(__dirname, "summarize-prompt.md"),
	"utf-8",
).replace("{{MAX_SUMMARY_LENGTH}}", String(MAX_SUMMARY_LENGTH));

export function initDeepseekSummarizer(deps: {
	createChatCompletion: CreateChatCompletion;
	findCachedSummary: FindCachedSummary;
	saveCachedSummary: SaveCachedSummary;
	logger: HutchLogger;
	cleanContent: (html: string) => string;
	isTooShortToSummarize: (cleanedText: string) => boolean;
}): { summarizeArticle: SummarizeArticle } {
	const summarizeArticle: SummarizeArticle = async (params) => {
		deps.logger.info("[summarize] starting", { url: params.url });

		const cached = await deps.findCachedSummary(params.url);
		if (cached) {
			deps.logger.info("[summarize] cache hit", { url: params.url });
			return null;
		}

		const cleanedContent = deps.cleanContent(params.textContent);

		if (deps.isTooShortToSummarize(cleanedContent)) {
			deps.logger.info("[summarize] content too short, skipping", { url: params.url });
			return null;
		}

		deps.logger.info("[summarize] cache miss, calling DeepSeek", { url: params.url });

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
		return {
			summary,
			inputTokens: response.usage.prompt_tokens,
			outputTokens: response.usage.completion_tokens,
		};
	};

	return { summarizeArticle };
}
