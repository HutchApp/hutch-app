import type { SQSHandler } from "aws-lambda";
import type { HutchLogger } from "@packages/hutch-logger";
import { RefreshArticleContentCommand } from "./index";

export type RefreshArticleContent = (params: {
	url: string;
	metadata: {
		title: string;
		siteName: string;
		excerpt: string;
		wordCount: number;
		imageUrl?: string;
	};
	estimatedReadTime: number;
	etag?: string;
	lastModified?: string;
	contentFetchedAt: string;
}) => Promise<void>;

export function initRefreshArticleContentHandler(deps: {
	refreshArticleContent: RefreshArticleContent;
	logger: HutchLogger;
}): SQSHandler {
	const { refreshArticleContent, logger } = deps;

	return async (event) => {
		for (const record of event.Records) {
			const envelope = JSON.parse(record.body);
			const detail = RefreshArticleContentCommand.detailSchema.parse(envelope.detail);

			logger.info("[RefreshArticleContent] processing", { url: detail.url });

			await refreshArticleContent(detail);

			logger.info("[RefreshArticleContent] completed", { url: detail.url });
		}
	};
}
