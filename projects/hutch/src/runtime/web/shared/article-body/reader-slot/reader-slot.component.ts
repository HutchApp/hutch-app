import type { ArticleCrawl } from "../../../../providers/article-crawl/article-crawl.types";
import type { ProgressTick } from "../progress-mapping";
import { renderReaderFailed } from "./reader-failed.component";
import { renderReaderPending } from "./reader-pending.component";
import { renderReaderReady } from "./reader-ready.component";
import { renderReaderUnavailable } from "./reader-unavailable.component";

export interface ReaderSlotInput {
	crawl?: ArticleCrawl;
	content?: string;
	url: string;
	readerPollUrl?: string;
	crawlProgress?: ProgressTick;
}

export function renderReaderSlot(input: ReaderSlotInput): string {
	if (input.crawl?.status === "pending") {
		return renderReaderPending({
			pollUrl: input.readerPollUrl,
			progress: input.crawlProgress,
		});
	}
	if (input.crawl?.status === "failed") {
		return renderReaderFailed({ url: input.url });
	}
	// crawl ready (explicit) or undefined (legacy row): render content if present,
	// otherwise fall back to the unavailable message used historically when an
	// article row exists but no body has been fetched.
	if (input.content) {
		return renderReaderReady({ content: input.content });
	}
	return renderReaderUnavailable({ url: input.url });
}
