import type { SQSHandler } from "aws-lambda";
import { SendMessageCommand } from "@aws-sdk/client-sqs";
import type { HutchLogger } from "@packages/hutch-logger";
import { AnonymousLinkSavedEvent } from "@packages/hutch-infra-components";
import type { FindArticleContent } from "./find-article-content";

export function initAnonymousLinkSavedHandler(deps: {
	sqsClient: { send: (command: SendMessageCommand) => Promise<unknown> };
	queueUrl: string;
	findArticleContent: FindArticleContent;
	logger: HutchLogger;
}): SQSHandler {
	const { sqsClient, queueUrl, findArticleContent, logger } = deps;

	return async (event) => {
		for (const record of event.Records) {
			const envelope = JSON.parse(record.body);
			const detail = AnonymousLinkSavedEvent.detailSchema.parse(envelope.detail);

			logger.info("[AnonymousLinkSaved] processing", { url: detail.url });

			const content = await findArticleContent(detail.url);
			if (!content) {
				logger.info("[AnonymousLinkSaved] no content available, skipping summary", { url: detail.url });
				continue;
			}

			await sqsClient.send(
				new SendMessageCommand({
					QueueUrl: queueUrl,
					MessageBody: JSON.stringify({ url: detail.url }),
				}),
			);

			logger.info("[AnonymousLinkSaved] dispatched GenerateGlobalSummary", { url: detail.url });
		}
	};
}
