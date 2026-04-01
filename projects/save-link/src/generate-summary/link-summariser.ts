import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { HutchLogger } from "@packages/hutch-logger";
import type {
	CreateAiMessage,
	FindCachedSummary,
	SaveCachedSummary,
	SummarizeArticle,
} from "./article-summary.types";
import { MAX_SUMMARY_LENGTH } from "./max-summary-length";

const SUMMARIZE_PROMPT = readFileSync(
	join(__dirname, "summarize-prompt.md"),
	"utf-8",
).replace("{{MAX_SUMMARY_LENGTH}}", String(MAX_SUMMARY_LENGTH));

export function initLinkSummariser(deps: {
	createMessage: CreateAiMessage;
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
		const visibleLength = cleanedContent.replace(/\s/g, "").length;

		if (deps.isTooShortToSummarize(cleanedContent)) {
			deps.logger.info("[summarize] content too short, skipping", { url: params.url, visibleLength });
			return null;
		}

		deps.logger.info("[summarize] cache miss, calling AI", { url: params.url, visibleLength });

		const response = await deps.createMessage({
			model: "claude-sonnet-4-6",
			max_tokens: 10240,
			system: SUMMARIZE_PROMPT,
			messages: [{ role: "user", content: cleanedContent }],
			output_config: {
				format: {
					type: "json_schema",
					schema: {
						type: "object",
						properties: {
							summary: {
								type: "string",
								description: `Plain text summary, max ${MAX_SUMMARY_LENGTH} characters`,
							},
						},
						required: ["summary"],
						additionalProperties: false,
					},
				},
			},
		});

		const textBlock = response.content.find(
			(block) => block.type === "text",
		);
		if (!textBlock || textBlock.type !== "text" || !textBlock.text) {
			deps.logger.info("[summarize] no text block in response", { url: params.url });
			return null;
		}

		const parsed = z.object({ summary: z.string() }).parse(JSON.parse(textBlock.text));
		const summary = parsed.summary.trim();
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
		return {
			summary,
			inputTokens: response.usage.input_tokens,
			outputTokens: response.usage.output_tokens,
		};
	};

	return { summarizeArticle };
}
