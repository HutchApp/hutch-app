import type { SQSHandler } from "aws-lambda";
import type { HutchLogger } from "@packages/hutch-logger";
import type { PublishEvent } from "@packages/hutch-infra-components/runtime";
import {
	CrawlArticleFailedEvent,
	SaveLinkRawHtmlCommand,
} from "@packages/hutch-infra-components";
import type { MarkCrawlFailed } from "./article-crawl.types";

interface SaveLinkRawHtmlDlqHandlerDeps {
	markCrawlFailed: MarkCrawlFailed;
	publishEvent: PublishEvent;
	logger: HutchLogger;
}

/* c8 ignore next -- V8 block coverage phantom on typed-parameter destructuring, see bcoe/c8#319 */
export function initSaveLinkRawHtmlDlqHandler(deps: SaveLinkRawHtmlDlqHandlerDeps): SQSHandler {
	const { markCrawlFailed, publishEvent, logger } = deps;

	return async (event) => {
		for (const record of event.Records) {
			const envelope = JSON.parse(record.body);
			const command = SaveLinkRawHtmlCommand.detailSchema.parse(envelope.detail);
			const receiveCount = Number(record.attributes.ApproximateReceiveCount);
			const reason = "exceeded SQS maxReceiveCount";

			logger.info("[SaveLinkRawHtmlDlq] marking crawl failed", {
				url: command.url,
				receiveCount,
			});

			await markCrawlFailed({ url: command.url, reason });

			await publishEvent({
				source: CrawlArticleFailedEvent.source,
				detailType: CrawlArticleFailedEvent.detailType,
				detail: JSON.stringify({ url: command.url, reason, receiveCount }),
			});
		}
	};
}
