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
import { initSaveLinkDlqHandler } from "./save-link-dlq-handler";
import type { SQSEvent, SQSRecordAttributes, Context } from "aws-lambda";

function attributes(receiveCount: number): SQSRecordAttributes {
	return {
		ApproximateReceiveCount: String(receiveCount),
		SentTimestamp: "1620000000000",
		SenderId: "TESTID",
		ApproximateFirstReceiveTimestamp: "1620000000001",
	};
}

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

const URL = "https://example.com/failed";

function buildArticle(overrides: Partial<Article> = {}): Article {
	return {
		url: URL,
		version: 1,
		crawl: { status: "pending" },
		summary: { status: "pending" },
		metadata: {
			title: "T",
			siteName: "example.com",
			excerpt: "E",
			wordCount: 0,
		},
		estimatedReadTime: 0 as Minutes,
		...overrides,
	};
}

function createSqsEvent(
	detail: { url: string; userId: string },
	receiveCount = 3,
): SQSEvent {
	return {
		Records: [
			{
				messageId: "msg-1",
				receiptHandle: "receipt-1",
				body: JSON.stringify({ detail }),
				attributes: attributes(receiveCount),
				messageAttributes: {},
				md5OfBody: "",
				eventSource: "aws:sqs",
				eventSourceARN:
					"arn:aws:sqs:ap-southeast-2:123456789:save-link-command-dlq",
				awsRegion: "ap-southeast-2",
			},
		],
	};
}

describe("initSaveLinkDlqHandler", () => {
	it("transitions the article to crawl=failed + summary=failed and publishes CrawlArticleFailedEvent in one orchestration", async () => {
		// The legacy DLQ handler did three sequential awaits
		// (markCrawlFailed, markSummaryFailed, publishEvent) and could leave
		// the row half-failed if any threw. The aggregate transition
		// `markCrawlExhausted` returns the new article + the event in one
		// shape — the bridged storage write and the dispatcher fire atomically
		// per orchestration.
		const store = initInMemoryArticleStore();
		const dispatcher = initInMemoryEffectDispatcher();
		store.seed(buildArticle({ version: 1 }));
		const transitionAndPersist = initTransitionAndPersist({
			store,
			dispatcher: dispatcher.dispatch,
		});

		const handler = initSaveLinkDlqHandler({
			transitionAndPersist,
			now: () => new Date("2026-05-11T00:00:00.000Z"),
			logger: noopLogger,
		});

		await handler(
			createSqsEvent({ url: URL, userId: "user-1" }, 4),
			stubContext,
			() => {},
		);

		const after = store.peek(URL);
		expect(after?.crawl).toEqual({
			status: "failed",
			reason: "exceeded SQS maxReceiveCount",
			failedAt: "2026-05-11T00:00:00.000Z",
		});
		expect(after?.summary).toEqual({
			status: "failed",
			reason: "crawl failed",
		});
		expect(dispatcher.flat()).toEqual([
			{
				kind: "PublishCrawlArticleFailedEvent",
				url: URL,
				reason: "exceeded SQS maxReceiveCount",
				receiveCount: 4,
			},
		]);
	});

	it("skips silently when the URL has no aggregate row (the failing command never wrote one)", async () => {
		// SaveLinkCommand can fail before its handler writes the article row
		// (bad URL, IAM, parse failure pre-write). The DLQ has nothing to
		// mark — the existing per-state writers used attribute_not_exists to
		// implicitly upsert; the aggregate uses skipIfMissing instead so the
		// transition stays a pure operation over an existing row.
		const store = initInMemoryArticleStore();
		const dispatcher = initInMemoryEffectDispatcher();
		const transitionAndPersist = initTransitionAndPersist({
			store,
			dispatcher: dispatcher.dispatch,
		});

		const handler = initSaveLinkDlqHandler({
			transitionAndPersist,
			now: () => new Date(),
			logger: noopLogger,
		});

		const result = await handler(
			createSqsEvent({ url: URL, userId: "user-1" }, 4),
			stubContext,
			() => {},
		);

		expect(result).toEqual({ batchItemFailures: [] });
		expect(dispatcher.flat()).toEqual([]);
	});

	it("does NOT regress a row that already reached crawl=ready (sibling tier-0 capture won the race)", async () => {
		// The transition is idempotent against terminal crawl states so a
		// late-arriving DLQ delivery cannot flip a perfectly readable article
		// back to "crawl failed" because of an exhausted retry message.
		const store = initInMemoryArticleStore();
		const dispatcher = initInMemoryEffectDispatcher();
		store.seed(buildArticle({ version: 1, crawl: { status: "ready" } }));
		const transitionAndPersist = initTransitionAndPersist({
			store,
			dispatcher: dispatcher.dispatch,
		});

		const handler = initSaveLinkDlqHandler({
			transitionAndPersist,
			now: () => new Date(),
			logger: noopLogger,
		});

		await handler(
			createSqsEvent({ url: URL, userId: "user-1" }, 4),
			stubContext,
			() => {},
		);

		expect(store.peek(URL)?.crawl).toEqual({ status: "ready" });
		expect(dispatcher.flat()).toEqual([]);
	});

	it("reports the record as a batch failure on invalid command envelope (Zod failure)", async () => {
		const store = initInMemoryArticleStore();
		const dispatcher = initInMemoryEffectDispatcher();
		const transitionAndPersist = initTransitionAndPersist({
			store,
			dispatcher: dispatcher.dispatch,
		});

		const handler = initSaveLinkDlqHandler({
			transitionAndPersist,
			now: () => new Date(),
			logger: noopLogger,
		});

		const invalidEvent: SQSEvent = {
			Records: [
				{
					messageId: "msg-1",
					receiptHandle: "receipt-1",
					body: JSON.stringify({ detail: { invalid: true } }),
					attributes: attributes(3),
					messageAttributes: {},
					md5OfBody: "",
					eventSource: "aws:sqs",
					eventSourceARN:
						"arn:aws:sqs:ap-southeast-2:123456789:save-link-command-dlq",
					awsRegion: "ap-southeast-2",
				},
			],
		};

		const result = await handler(invalidEvent, stubContext, () => {});
		expect(result).toEqual({
			batchItemFailures: [{ itemIdentifier: "msg-1" }],
		});
		expect(dispatcher.flat()).toEqual([]);
	});
});
