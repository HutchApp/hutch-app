import assert from "node:assert";
import type { SQSHandler } from "aws-lambda";
import type { HutchLogger } from "@packages/hutch-logger";
import type { PublishEvent } from "@packages/hutch-infra-components/runtime";
import {
	GenerateSummaryCommand,
	SummaryGeneratedEvent,
} from "./index";
import type { SummarizeArticle } from "./article-summary.types";
import type { FindArticleContent } from "../save-link/find-article-content";

export function initGenerateSummaryHandler(deps: {
	summarizeArticle: SummarizeArticle;
	findArticleContent: FindArticleContent;
	publishEvent: PublishEvent;
	logger: HutchLogger;
}): SQSHandler {
	const { summarizeArticle, findArticleContent, publishEvent, logger } = deps;

	return async (event) => {
		for (const record of event.Records) {
			const command = GenerateSummaryCommand.detailSchema.parse(
				JSON.parse(record.body),
			);

			logger.info("[GenerateGlobalSummary] processing", { url: command.url });

			const content = await findArticleContent(command.url);
			assert(content, `Article content not found: ${command.url}`);

			const result = await summarizeArticle({
				url: command.url,
				textContent: content,
			});

			if (!result) {
				logger.info("[GenerateGlobalSummary] already summarized, skipping", { url: command.url });
				continue;
			}

			await publishEvent({
				source: SummaryGeneratedEvent.source,
				detailType: SummaryGeneratedEvent.detailType,
				detail: JSON.stringify({
					url: command.url,
					inputTokens: result.inputTokens,
					outputTokens: result.outputTokens,
				}),
			});

			logger.info("[GenerateGlobalSummary] completed", {
				url: command.url,
				inputTokens: result.inputTokens,
				outputTokens: result.outputTokens,
			});
		}
	};
}
