import type { SQSHandler } from "aws-lambda";
import type { HutchLogger } from "@packages/hutch-logger";
import { SaveLinkRawHtmlCommand } from "@packages/hutch-infra-components";
import { ArticleResourceUniqueId } from "../save-link/article-resource-unique-id";
import type { ParseHtml } from "../article-parser/article-parser.types";
import type { DownloadMedia } from "../save-link/download-media";
import type { ProcessContent } from "../save-link/save-link-work";
import type { ReadPendingHtml } from "./read-pending-html";
import type { PutSourceContent } from "./source-content.types";

const TIER = "tier-0";

export function initSaveLinkRawHtmlCommandHandler(deps: {
	readPendingHtml: ReadPendingHtml;
	parseHtml: ParseHtml;
	downloadMedia: DownloadMedia;
	processContent: ProcessContent;
	putSourceContent: PutSourceContent;
	logger: HutchLogger;
}): SQSHandler {
	const {
		readPendingHtml,
		parseHtml,
		downloadMedia,
		processContent,
		putSourceContent,
		logger,
	} = deps;

	return async (event) => {
		for (const record of event.Records) {
			const envelope = JSON.parse(record.body);
			const detail = SaveLinkRawHtmlCommand.detailSchema.parse(envelope.detail);

			const rawHtml = await readPendingHtml(detail.url);
			const parseResult = parseHtml({ url: detail.url, html: rawHtml });
			if (!parseResult.ok) {
				throw new Error(`save-link-raw-html parse failed for ${detail.url}: ${parseResult.reason}`);
			}

			const articleResourceUniqueId = ArticleResourceUniqueId.parse(detail.url);
			const media = await downloadMedia({
				html: parseResult.article.content,
				articleResourceUniqueId,
			});
			const processedHtml = await processContent({ html: parseResult.article.content, media });

			await putSourceContent({ url: detail.url, tier: TIER, html: processedHtml });

			logger.info("[SaveLinkRawHtmlCommand] saved tier-0 source", { url: detail.url });
		}
	};
}
