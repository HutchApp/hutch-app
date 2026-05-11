import { noopLogger } from "@packages/hutch-logger";
import {
	type Article,
	type Minutes,
	initTransitionAndPersist,
} from "@packages/domain/article";
import {
	initInMemoryArticleStore,
	initInMemoryEffectDispatcher,
} from "@packages/test-fixtures/providers/article-aggregate";
import type { SQSEvent, SQSRecordAttributes, Context } from "aws-lambda";
import { initRefreshArticleContentHandler } from "./refresh-article-content-handler";

const stubAttributes: SQSRecordAttributes = {
	ApproximateReceiveCount: "1",
	SentTimestamp: "1620000000000",
	SenderId: "TESTID",
	ApproximateFirstReceiveTimestamp: "1620000000001",
};

const stubContext: Context = {
	callbackWaitsForEmptyEventLoop: true,
	functionName: "test",
	functionVersion: "1",
	invokedFunctionArn: "arn:aws:lambda:ap-southeast-2:123456789:function:test",
	memoryLimitInMB: "128",
	awsRequestId: "test-request-id",
	logGroupName: "/aws/lambda/test",
	logStreamName: "test-stream",
	getRemainingTimeInMillis: () => 30000,
	done: () => {},
	fail: () => {},
	succeed: () => {},
};

const ARTICLE_URL = "https://example.com/article";

function buildSavedArticle(overrides: Partial<Article> = {}): Article {
	return {
		url: ARTICLE_URL,
		crawl: { status: "ready" },
		summary: {
			status: "ready",
			summary: "Old summary",
			excerpt: "Old excerpt",
			inputTokens: 50,
			outputTokens: 25,
		},
		metadata: {
			title: "Old title",
			siteName: "example.com",
			excerpt: "Old metadata excerpt",
			wordCount: 100,
		},
		estimatedReadTime: 1 as Minutes,
		...overrides,
	};
}

function createSqsEvent(detail: {
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
}): SQSEvent {
	return {
		Records: [
			{
				messageId: "msg-1",
				receiptHandle: "receipt-1",
				body: JSON.stringify({ detail }),
				attributes: stubAttributes,
				messageAttributes: {},
				md5OfBody: "",
				eventSource: "aws:sqs",
				eventSourceARN: "arn:aws:sqs:ap-southeast-2:123456789:RefreshArticleContent",
				awsRegion: "ap-southeast-2",
			},
		],
	};
}

describe("initRefreshArticleContentHandler", () => {
	it("loads the aggregate, applies refreshContent, persists and dispatches the regen command in one orchestration", async () => {
		// Why this matters: refreshContent invalidates the cached summary
		// (clears summary text + flips status back to pending). If the handler
		// did not also dispatch GenerateSummaryCommand the row would sit in
		// the pending state forever — no worker would ever pick it up — and
		// the reader would render "Generating summary…" indefinitely. This is
		// exactly the regression that left
		// fagnerbrack.com/why-developers-become-frustrated-… stuck after the
		// 2026-05-10 freshness refresh. The aggregate's "save → dispatch"
		// orchestration makes that gap impossible at compile time: the
		// transition is a single function whose return value is both the new
		// article AND the event the worker needs.
		const store = initInMemoryArticleStore();
		const dispatcher = initInMemoryEffectDispatcher();
		store.seed(buildSavedArticle());

		const transitionAndPersist = initTransitionAndPersist({
			store,
			dispatcher: dispatcher.dispatch,
		});
		const handler = initRefreshArticleContentHandler({
			transitionAndPersist,
			logger: noopLogger,
		});

		await handler(
			createSqsEvent({
				url: ARTICLE_URL,
				metadata: {
					title: "New title",
					siteName: "example.com",
					excerpt: "New excerpt",
					wordCount: 200,
				},
				estimatedReadTime: 2,
				etag: '"abc"',
				lastModified: "Thu, 10 Apr 2026 12:00:00 GMT",
				contentFetchedAt: "2026-04-10T12:00:00Z",
			}),
			stubContext,
			() => {},
		);

		const updated = store.peek(ARTICLE_URL);
		expect(updated?.metadata.title).toBe("New title");
		expect(updated?.summary).toEqual({ status: "pending" });
		expect(dispatcher.flat()).toEqual([
			{ kind: "DispatchGenerateSummaryCommand", url: ARTICLE_URL },
		]);
	});

	it("dispatches AFTER the storage write so the worker never reads a status=ready cache hit", async () => {
		// Why this matters: summarizeArticle short-circuits when the cached
		// summaryStatus is "ready" or "skipped" (link-summariser.ts:52). If we
		// dispatched the command before the aggregate was persisted with
		// summary.status=pending, a fast-running worker could read the stale
		// cache, log "already summarized", and return — leaving the row with
		// the new content but no regenerated summary. The orchestrator's
		// load → save → dispatch ordering is what eliminates the race.
		const store = initInMemoryArticleStore();
		const dispatcher = initInMemoryEffectDispatcher();
		store.seed(buildSavedArticle());
		const order: string[] = [];
		const wrappedStore = {
			load: async (u: string) => {
				order.push("load");
				return store.load(u);
			},
			save: async (a: Parameters<typeof store.save>[0]) => {
				order.push("save");
				return store.save(a);
			},
		};
		const wrappedDispatcher = async (
			effects: Parameters<typeof dispatcher.dispatch>[0],
		): Promise<void> => {
			order.push("dispatch");
			return dispatcher.dispatch(effects);
		};

		const transitionAndPersist = initTransitionAndPersist({
			store: wrappedStore,
			dispatcher: wrappedDispatcher,
		});
		const handler = initRefreshArticleContentHandler({
			transitionAndPersist,
			logger: noopLogger,
		});

		await handler(
			createSqsEvent({
				url: ARTICLE_URL,
				metadata: {
					title: "Test",
					siteName: "example.com",
					excerpt: "Excerpt",
					wordCount: 100,
				},
				estimatedReadTime: 1,
				contentFetchedAt: "2026-04-10T12:00:00Z",
			}),
			stubContext,
			() => {},
		);

		expect(order).toEqual(["load", "save", "dispatch"]);
	});

	it("reports the record as a batch failure on invalid event detail (Zod failure)", async () => {
		const store = initInMemoryArticleStore();
		const dispatcher = initInMemoryEffectDispatcher();
		const transitionAndPersist = initTransitionAndPersist({
			store,
			dispatcher: dispatcher.dispatch,
		});
		const handler = initRefreshArticleContentHandler({
			transitionAndPersist,
			logger: noopLogger,
		});

		const invalidEvent: SQSEvent = {
			Records: [
				{
					messageId: "msg-1",
					receiptHandle: "receipt-1",
					body: JSON.stringify({ detail: { invalid: true } }),
					attributes: stubAttributes,
					messageAttributes: {},
					md5OfBody: "",
					eventSource: "aws:sqs",
					eventSourceARN: "arn:aws:sqs:ap-southeast-2:123456789:RefreshArticleContent",
					awsRegion: "ap-southeast-2",
				},
			],
		};

		const result = await handler(invalidEvent, stubContext, () => {});
		expect(result).toEqual({
			batchItemFailures: [{ itemIdentifier: "msg-1" }],
		});
	});

	it("does not dispatch when the storage save throws — surfaces the SQS-retry signal", async () => {
		// Why this matters: dispatching a regen command for an URL whose row
		// the DDB update could not write would summarise stale content (or
		// stamp a row that does not exist). The orchestrator's contract is
		// "no dispatch unless save succeeded" — and on a save failure the
		// handler must report the SQS message as a batch-item failure so
		// SQS retries it.
		const store = initInMemoryArticleStore();
		const dispatcher = initInMemoryEffectDispatcher();
		store.seed(buildSavedArticle());
		const failingSave = async () => {
			throw new Error("DDB throttled");
		};
		const transitionAndPersist = initTransitionAndPersist({
			store: { load: store.load, save: failingSave },
			dispatcher: dispatcher.dispatch,
		});
		const handler = initRefreshArticleContentHandler({
			transitionAndPersist,
			logger: noopLogger,
		});

		const result = await handler(
			createSqsEvent({
				url: ARTICLE_URL,
				metadata: {
					title: "Test",
					siteName: "example.com",
					excerpt: "Excerpt",
					wordCount: 100,
				},
				estimatedReadTime: 1,
				contentFetchedAt: "2026-04-10T12:00:00Z",
			}),
			stubContext,
			() => {},
		);

		expect(dispatcher.flat()).toEqual([]);
		expect(result).toEqual({
			batchItemFailures: [{ itemIdentifier: "msg-1" }],
		});
	});

	it("reports a batch failure if the article does not exist in the aggregate store", async () => {
		// Pre-aggregate code path would have implicitly upserted (UpdateExpression
		// with no condition). The aggregate requires the article to exist so the
		// transition has well-defined input; a missing row indicates either a
		// race with delete or a bug in the upstream save flow, neither of which
		// the worker can recover from in-process. SQS retries; eventually DLQ.
		const store = initInMemoryArticleStore();
		const dispatcher = initInMemoryEffectDispatcher();
		const transitionAndPersist = initTransitionAndPersist({
			store,
			dispatcher: dispatcher.dispatch,
		});
		const handler = initRefreshArticleContentHandler({
			transitionAndPersist,
			logger: noopLogger,
		});

		const result = await handler(
			createSqsEvent({
				url: ARTICLE_URL,
				metadata: {
					title: "Test",
					siteName: "example.com",
					excerpt: "Excerpt",
					wordCount: 100,
				},
				estimatedReadTime: 1,
				contentFetchedAt: "2026-04-10T12:00:00Z",
			}),
			stubContext,
			() => {},
		);

		expect(result).toEqual({
			batchItemFailures: [{ itemIdentifier: "msg-1" }],
		});
		expect(dispatcher.flat()).toEqual([]);
	});
});
