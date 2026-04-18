import { noopLogger } from "@packages/hutch-logger";
import { initAnonymousLinkSavedHandler } from "./anonymous-link-saved-handler";
import type { FindArticleContent } from "./find-article-content";
import type { SQSEvent, SQSRecordAttributes, Context } from "aws-lambda";

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

function createSqsEvent(detail: { url: string }): SQSEvent {
	return {
		Records: [{
			messageId: "msg-1",
			receiptHandle: "receipt-1",
			body: JSON.stringify({ detail }),
			attributes: stubAttributes,
			messageAttributes: {},
			md5OfBody: "",
			eventSource: "aws:sqs",
			eventSourceARN: "arn:aws:sqs:ap-southeast-2:123456789:AnonymousLinkSaved",
			awsRegion: "ap-southeast-2",
		}],
	};
}

describe("initAnonymousLinkSavedHandler", () => {
	it("dispatches GenerateGlobalSummary when the article has content", async () => {
		const sendMessage = jest.fn().mockResolvedValue({});
		const sqsClient = { send: sendMessage };
		const findArticleContent: FindArticleContent = async () => ({ content: "<p>Some content</p>" });

		const handler = initAnonymousLinkSavedHandler({
			sqsClient,
			queueUrl: "https://sqs.ap-southeast-2.amazonaws.com/123/GenerateGlobalSummary",
			findArticleContent,
			logger: noopLogger,
		});

		await handler(createSqsEvent({ url: "https://example.com/article" }), stubContext, () => {});

		expect(sendMessage).toHaveBeenCalledTimes(1);
		const command = sendMessage.mock.calls[0][0];
		expect(JSON.parse(command.input.MessageBody)).toEqual({ url: "https://example.com/article" });
	});

	it("skips summary dispatch when the article has no content", async () => {
		const sendMessage = jest.fn();
		const sqsClient = { send: sendMessage };
		const findArticleContent: FindArticleContent = async () => undefined;

		const handler = initAnonymousLinkSavedHandler({
			sqsClient,
			queueUrl: "https://sqs.ap-southeast-2.amazonaws.com/123/GenerateGlobalSummary",
			findArticleContent,
			logger: noopLogger,
		});

		await handler(createSqsEvent({ url: "https://example.com/no-content" }), stubContext, () => {});

		expect(sendMessage).not.toHaveBeenCalled();
	});

	it("throws on invalid event detail", async () => {
		const sqsClient = { send: jest.fn() };
		const findArticleContent: FindArticleContent = async () => ({ content: "content" });

		const handler = initAnonymousLinkSavedHandler({
			sqsClient,
			queueUrl: "https://sqs.ap-southeast-2.amazonaws.com/123/GenerateGlobalSummary",
			findArticleContent,
			logger: noopLogger,
		});

		const invalidEvent: SQSEvent = {
			Records: [{
				messageId: "msg-1",
				receiptHandle: "receipt-1",
				body: JSON.stringify({ detail: { invalid: true } }),
				attributes: stubAttributes,
				messageAttributes: {},
				md5OfBody: "",
				eventSource: "aws:sqs",
				eventSourceARN: "arn:aws:sqs:ap-southeast-2:123456789:AnonymousLinkSaved",
				awsRegion: "ap-southeast-2",
			}],
		};

		await expect(
			handler(invalidEvent, stubContext, () => {}),
		).rejects.toThrow();
	});
});
