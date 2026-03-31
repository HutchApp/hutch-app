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
			return null;
		}

		deps.logger.info("[summarize] cache miss, calling Claude", { url: params.url });
		const cleanedContent = deps.cleanContent(params.textContent);

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
								description: "Plain text summary, max 750 characters",
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
