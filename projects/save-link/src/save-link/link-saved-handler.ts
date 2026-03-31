import assert from "node:assert";
import type { SQSHandler } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import type { HutchLogger } from "@packages/hutch-logger";
import { LinkSavedDetailSchema } from "./index";
import type { FindArticleContent } from "./find-article-content";

export function initLinkSavedHandler(deps: {
	sqsClient: SQSClient;
	queueUrl: string;
	findArticleContent: FindArticleContent;
	logger: HutchLogger;
}): SQSHandler {
	const { sqsClient, queueUrl, findArticleContent, logger } = deps;

	return async (event) => {
		for (const record of event.Records) {
			const envelope = JSON.parse(record.body);
			const detail = LinkSavedDetailSchema.parse(envelope.detail);

			logger.info("[LinkSaved] processing", { url: detail.url, userId: detail.userId });

			const content = await findArticleContent(detail.url);
			assert(content, `Article has no content: ${detail.url}`);

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

export { SQSClient };
