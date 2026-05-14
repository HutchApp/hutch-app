import type { Handler, SQSBatchItemFailure, SQSBatchResponse, SQSEvent } from "aws-lambda";
import type { HutchLogger } from "@packages/hutch-logger";
import {
	markSummaryExhausted,
	type TransitionAndPersist,
} from "@packages/domain/article-aggregate";
import { LinkSavedEvent } from "@packages/hutch-infra-components";

interface LinkSavedDlqHandlerDeps {
	transitionAndPersist: TransitionAndPersist;
	logger: HutchLogger;
}

/* c8 ignore next -- V8 block coverage phantom on typed-parameter destructuring, see bcoe/c8#319 */
export function initLinkSavedDlqHandler(deps: LinkSavedDlqHandlerDeps): Handler<SQSEvent, SQSBatchResponse> {
	const { transitionAndPersist, logger } = deps;

	return async (event): Promise<SQSBatchResponse> => {
		const batchItemFailures: SQSBatchItemFailure[] = [];

		for (const record of event.Records) {
			try {
				const envelope = JSON.parse(record.body);
				const detail = LinkSavedEvent.detailSchema.parse(envelope.detail);
				const receiveCount = Number(record.attributes.ApproximateReceiveCount);

				logger.info("[LinkSavedDlq] marking summary exhausted", {
					url: detail.url,
					receiveCount,
				});

				await transitionAndPersist(markSummaryExhausted, {
					url: detail.url,
					input: {
						reason: { kind: "exhausted-retries", receiveCount },
						receiveCount,
					},
				});
			} catch (error) {
				logger.error("[LinkSavedDlq] record failed", {
					messageId: record.messageId,
					error,
				});
				batchItemFailures.push({ itemIdentifier: record.messageId });
			}
		}

		return { batchItemFailures };
	};
}
