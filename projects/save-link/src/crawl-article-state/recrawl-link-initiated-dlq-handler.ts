import type { Handler, SQSBatchItemFailure, SQSBatchResponse, SQSEvent } from "aws-lambda";
import type { HutchLogger } from "@packages/hutch-logger";
import { RecrawlLinkInitiatedEvent } from "@packages/hutch-infra-components";
import {
	type initTransitionAndPersist,
	markCrawlExhausted,
} from "@packages/domain/article";

export type TransitionAndPersist = ReturnType<typeof initTransitionAndPersist>;

interface RecrawlLinkInitiatedDlqHandlerDeps {
	transitionAndPersist: TransitionAndPersist;
	now: () => Date;
	logger: HutchLogger;
}

/* c8 ignore next -- V8 block coverage phantom on typed-parameter destructuring, see bcoe/c8#319 */
export function initRecrawlLinkInitiatedDlqHandler(
	deps: RecrawlLinkInitiatedDlqHandlerDeps,
): Handler<SQSEvent, SQSBatchResponse> {
	const { transitionAndPersist, now, logger } = deps;

	return async (event): Promise<SQSBatchResponse> => {
		const batchItemFailures: SQSBatchItemFailure[] = [];

		for (const record of event.Records) {
			try {
				const envelope = JSON.parse(record.body);
				const detail = RecrawlLinkInitiatedEvent.detailSchema.parse(envelope.detail);
				const receiveCount = Number(record.attributes.ApproximateReceiveCount);
				const reason = "exceeded SQS maxReceiveCount";

				logger.info("[RecrawlLinkInitiatedDlq] marking crawl failed", {
					url: detail.url,
					receiveCount,
				});

				await transitionAndPersist({
					url: detail.url,
					transition: markCrawlExhausted,
					params: {
						reason,
						receiveCount,
						failedAt: now().toISOString(),
					},
					skipIfMissing: true,
				});
			} catch (error) {
				logger.error("[RecrawlLinkInitiatedDlq] record failed", {
					messageId: record.messageId,
					error,
				});
				batchItemFailures.push({ itemIdentifier: record.messageId });
			}
		}

		return { batchItemFailures };
	};
}
