import type { Handler, SQSBatchItemFailure, SQSBatchResponse, SQSEvent } from "aws-lambda";
import type { HutchLogger } from "@packages/hutch-logger";
import type { Minutes } from "@packages/domain/article";
import {
	type initTransitionAndPersist,
	refreshContent,
} from "@packages/domain/article";
import { RefreshArticleContentCommand } from "./index";

export type TransitionAndPersist = ReturnType<typeof initTransitionAndPersist>;

export function initRefreshArticleContentHandler(deps: {
	transitionAndPersist: TransitionAndPersist;
	logger: HutchLogger;
}): Handler<SQSEvent, SQSBatchResponse> {
	const { transitionAndPersist, logger } = deps;

	return async (event): Promise<SQSBatchResponse> => {
		const batchItemFailures: SQSBatchItemFailure[] = [];

		for (const record of event.Records) {
			try {
				const envelope = JSON.parse(record.body);
				const detail = RefreshArticleContentCommand.detailSchema.parse(envelope.detail);

				logger.info("[RefreshArticleContent] processing", { url: detail.url });

				await transitionAndPersist({
					url: detail.url,
					transition: refreshContent,
					params: {
						metadata: detail.metadata,
						estimatedReadTime: detail.estimatedReadTime as Minutes,
						contentFetchedAt: detail.contentFetchedAt,
						etag: detail.etag,
						lastModified: detail.lastModified,
					},
				});

				logger.info("[RefreshArticleContent] completed", { url: detail.url });
			} catch (error) {
				logger.error("[RefreshArticleContent] record failed", {
					messageId: record.messageId,
					error,
				});
				batchItemFailures.push({ itemIdentifier: record.messageId });
			}
		}

		return { batchItemFailures };
	};
}
