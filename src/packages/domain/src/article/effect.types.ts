export type Effect =
	| { kind: "DispatchGenerateSummaryCommand"; url: string }
	| { kind: "PublishRecrawlLinkInitiatedEvent"; url: string }
	| {
			kind: "PublishCrawlArticleFailedEvent";
			url: string;
			reason: string;
			receiveCount: number;
		}
	| { kind: "PublishRecrawlCompletedEvent"; url: string };

export type DispatchEffects = (effects: readonly Effect[]) => Promise<void>;
