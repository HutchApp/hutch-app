import type { SQSHandler } from "aws-lambda";
import type { HutchLogger } from "@packages/hutch-logger";
import type { DispatchCommand } from "@packages/hutch-infra-components/runtime";
import type { GenerateSummaryCommand } from "@packages/hutch-infra-components";
import { LinkSavedEvent } from "./index";
import type { FindArticleContent } from "./find-article-content";

export function initLinkSavedHandler(deps: {
	dispatchGenerateSummary: DispatchCommand<typeof GenerateSummaryCommand>;
	findArticleContent: FindArticleContent;
	logger: HutchLogger;
}): SQSHandler {
	const { dispatchGenerateSummary, findArticleContent, logger } = deps;

	return async (event) => {
		for (const record of event.Records) {
			const envelope = JSON.parse(record.body);
			const detail = LinkSavedEvent.detailSchema.parse(envelope.detail);

			logger.info("[LinkSaved] processing", { url: detail.url, userId: detail.userId });

			const content = await findArticleContent(detail.url);
			if (!content) {
				logger.info("[LinkSaved] no content available, skipping summary", { url: detail.url });
				continue;
			}

			await dispatchGenerateSummary({ url: detail.url });

			logger.info("[LinkSaved] dispatched GenerateGlobalSummary", { url: detail.url });
		}
	};
}
