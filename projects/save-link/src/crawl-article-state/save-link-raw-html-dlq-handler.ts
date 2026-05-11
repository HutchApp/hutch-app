import type { Handler, SQSBatchItemFailure, SQSBatchResponse, SQSEvent } from "aws-lambda";
import type { HutchLogger } from "@packages/hutch-logger";
import { SaveLinkRawHtmlCommand } from "@packages/hutch-infra-components";
import {
	type initTransitionAndPersist,
	markCrawlExhausted,
} from "@packages/domain/article";

export type TransitionAndPersist = ReturnType<typeof initTransitionAndPersist>;

interface SaveLinkRawHtmlDlqHandlerDeps {
	transitionAndPersist: TransitionAndPersist;
	now: () => Date;
	logger: HutchLogger;
}

/* c8 ignore next -- V8 block coverage phantom on typed-parameter destructuring, see bcoe/c8#319 */
export function initSaveLinkRawHtmlDlqHandler(deps: SaveLinkRawHtmlDlqHandlerDeps): Handler<SQSEvent, SQSBatchResponse> {
	const { transitionAndPersist, now, logger } = deps;

	return async (event): Promise<SQSBatchResponse> => {
		const batchItemFailures: SQSBatchItemFailure[] = [];

		for (const record of event.Records) {
			try {
				const envelope = JSON.parse(record.body);
				const command = SaveLinkRawHtmlCommand.detailSchema.parse(envelope.detail);
				const receiveCount = Number(record.attributes.ApproximateReceiveCount);
				const reason = "exceeded SQS maxReceiveCount";

				logger.info("[SaveLinkRawHtmlDlq] marking crawl failed", {
					url: command.url,
					receiveCount,
				});

				await transitionAndPersist({
					url: command.url,
					transition: markCrawlExhausted,
					params: {
						reason,
						receiveCount,
						failedAt: now().toISOString(),
					},
					skipIfMissing: true,
				});
			} catch (error) {
				logger.error("[SaveLinkRawHtmlDlq] record failed", {
					messageId: record.messageId,
					error,
				});
				batchItemFailures.push({ itemIdentifier: record.messageId });
			}
		}

		return { batchItemFailures };
	};
}
