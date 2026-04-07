import type { SQSHandler } from "aws-lambda";
import type { HutchLogger } from "@packages/hutch-logger";
import { SaveLinkCommand } from "./index";
import { LinkId } from "./link-id";
import type { FindArticleContent } from "./find-article-content";

export type PutObject = (params: { key: string; content: string }) => Promise<string>;
export type UpdateContentLocation = (params: { url: string; contentLocation: string }) => Promise<void>;
type PublishLinkSaved = (params: { url: string; userId: string }) => Promise<void>;

function contentS3Key(normalizedUrl: string): string {
	return `content/${encodeURIComponent(normalizedUrl)}/content.html`;
}

export function initSaveLinkCommandHandler(deps: {
	findArticleContent: FindArticleContent;
	putObject: PutObject;
	updateContentLocation: UpdateContentLocation;
	publishLinkSaved: PublishLinkSaved;
	logger: HutchLogger;
}): SQSHandler {
	const { findArticleContent, putObject, updateContentLocation, publishLinkSaved, logger } = deps;

	return async (event) => {
		for (const record of event.Records) {
			const envelope = JSON.parse(record.body);
			const detail = SaveLinkCommand.detailSchema.parse(envelope.detail);

			logger.info("[SaveLinkCommand] processing", { url: detail.url, userId: detail.userId });

			const content = await findArticleContent(detail.url);

			if (content) {
				const normalizedUrl = LinkId.from(detail.url);
				const key = contentS3Key(normalizedUrl);
				const contentLocation = await putObject({ key, content });
				await updateContentLocation({ url: detail.url, contentLocation });
				logger.info("[SaveLinkCommand] saved content to S3", { url: detail.url, contentLocation });
			}

			await publishLinkSaved({ url: detail.url, userId: detail.userId });
			logger.info("[SaveLinkCommand] published LinkSavedEvent", { url: detail.url });
		}
	};
}
