import type { SQSHandler } from "aws-lambda";
import type { HutchLogger } from "@packages/hutch-logger";
import type { PublishEvent } from "@packages/hutch-infra-components/runtime";
import {
	CrawlArticleFailedEvent,
	RecrawlContentExtractedEvent,
} from "@packages/hutch-infra-components";
import type { MarkCrawlFailed } from "../crawl-article-state/article-crawl.types";

interface RecrawlContentExtractedDlqHandlerDeps {
	markCrawlFailed: MarkCrawlFailed;
	publishEvent: PublishEvent;
	logger: HutchLogger;
}

/* c8 ignore next -- V8 block coverage phantom on typed-parameter destructuring, see bcoe/c8#319 */
export function initRecrawlContentExtractedDlqHandler(
	deps: RecrawlContentExtractedDlqHandlerDeps,
): SQSHandler {
	const { markCrawlFailed, publishEvent, logger } = deps;

	return async (event) => {
		for (const record of event.Records) {
			const envelope = JSON.parse(record.body);
			const detail = RecrawlContentExtractedEvent.detailSchema.parse(envelope.detail);
			const receiveCount = Number(record.attributes.ApproximateReceiveCount);
			const reason = "exceeded SQS maxReceiveCount";

			logger.info("[RecrawlContentExtractedDlq] marking crawl failed", {
				url: detail.url,
				receiveCount,
			});

			await markCrawlFailed({ url: detail.url, reason });

			await publishEvent({
				source: CrawlArticleFailedEvent.source,
				detailType: CrawlArticleFailedEvent.detailType,
				detail: JSON.stringify({ url: detail.url, reason, receiveCount }),
			});
		}
	};
}
