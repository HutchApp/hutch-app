import type { SQSHandler } from "aws-lambda";
import { SendMessageCommand } from "@aws-sdk/client-sqs";
import type { HutchLogger } from "@packages/hutch-logger";
import { LinkSavedEvent } from "./index";
import type { FindArticleContent } from "./find-article-content";

export function initLinkSavedHandler(deps: {
	sqsClient: { send: (command: SendMessageCommand) => Promise<unknown> };
	queueUrl: string;
	findArticleContent: FindArticleContent;
	logger: HutchLogger;
}): SQSHandler {
	const { sqsClient, queueUrl, findArticleContent, logger } = deps;

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

			await sqsClient.send(
				new SendMessageCommand({
					QueueUrl: queueUrl,
					MessageBody: JSON.stringify({ url: detail.url }),
				}),
			);

			logger.info("[LinkSaved] dispatched GenerateGlobalSummary", { url: detail.url });
		}
	};
}
