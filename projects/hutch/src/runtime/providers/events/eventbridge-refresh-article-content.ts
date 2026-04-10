/* c8 ignore start -- thin SDK wrapper, only used in prod path */
import type { PublishEvent } from "@packages/hutch-infra-components/runtime";
import { RefreshArticleContentCommand } from "@packages/hutch-infra-components";
import type { PublishRefreshArticleContent } from "./publish-refresh-article-content.types";

export function initEventBridgeRefreshArticleContent(deps: {
	publishEvent: PublishEvent;
}): { publishRefreshArticleContent: PublishRefreshArticleContent } {
	const { publishEvent } = deps;

	const publishRefreshArticleContent: PublishRefreshArticleContent = async (params) => {
		await publishEvent({
			source: RefreshArticleContentCommand.source,
			detailType: RefreshArticleContentCommand.detailType,
			detail: JSON.stringify({
				url: params.url,
				metadata: params.metadata,
				estimatedReadTime: params.estimatedReadTime,
				etag: params.etag,
				lastModified: params.lastModified,
				contentFetchedAt: params.contentFetchedAt,
			}),
		});
	};

	return { publishRefreshArticleContent };
}
/* c8 ignore stop */
