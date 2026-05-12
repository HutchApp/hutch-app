import { noopLogger } from "@packages/hutch-logger";
import type { TransitionAndPersist } from "@packages/domain/article-aggregate";
import { initRecrawlContentExtractedDlqHandler } from "./recrawl-content-extracted-dlq-handler";
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

function createSqsEvent(detail: { url: string }, receiveCount = 3): SQSEvent {
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
					"arn:aws:sqs:ap-southeast-2:123456789:recrawl-content-extracted-dlq",
				awsRegion: "ap-southeast-2",
			},
		],
	};
}

describe("initRecrawlContentExtractedDlqHandler", () => {
	it("dispatches markCrawlExhausted with receiveCount when a message lands in DLQ", async () => {
		const transitionAndPersist = jest.fn().mockResolvedValue(undefined);

		const handler = initRecrawlContentExtractedDlqHandler({
			transitionAndPersist: transitionAndPersist as unknown as TransitionAndPersist,
			logger: noopLogger,
		});

		await handler(
			createSqsEvent({ url: "https://example.com/failed" }, 4),
			stubContext,
			() => {},
		);

		expect(transitionAndPersist).toHaveBeenCalledTimes(1);
		const [transition, params] = transitionAndPersist.mock.calls[0] ?? [];
		expect((transition as { name: string }).name).toBe("markCrawlExhausted");
		expect(params).toEqual({
			url: "https://example.com/failed",
			input: { reason: "exceeded SQS maxReceiveCount", receiveCount: 4 },
		});
	});

	it("reports the record as a batch failure on invalid event envelope (Zod failure)", async () => {
		const transitionAndPersist = jest.fn();

		const handler = initRecrawlContentExtractedDlqHandler({
			transitionAndPersist: transitionAndPersist as unknown as TransitionAndPersist,
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
						"arn:aws:sqs:ap-southeast-2:123456789:recrawl-content-extracted-dlq",
					awsRegion: "ap-southeast-2",
				},
			],
		};

		const result = await handler(invalidEvent, stubContext, () => {});
		expect(result).toEqual({
			batchItemFailures: [{ itemIdentifier: "msg-1" }],
		});
		expect(transitionAndPersist).not.toHaveBeenCalled();
	});
});
