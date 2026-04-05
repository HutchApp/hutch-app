import { noopLogger } from "@packages/hutch-logger";
import { initSaveLinkCommandHandler } from "./save-link-command-handler";
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

function createSqsEvent(detail: { url: string; userId: string }): SQSEvent {
	return {
		Records: [{
			messageId: "msg-1",
			receiptHandle: "receipt-1",
			body: JSON.stringify({ detail }),
			attributes: stubAttributes,
			messageAttributes: {},
			md5OfBody: "",
			eventSource: "aws:sqs",
			eventSourceARN: "arn:aws:sqs:ap-southeast-2:123456789:SaveLinkCommand",
			awsRegion: "ap-southeast-2",
		}],
	};
}

describe("initSaveLinkCommandHandler", () => {
	it("saves content to S3 and publishes LinkSavedEvent when article has content", async () => {
		const findArticleContent: FindArticleContent = async () => "<p>Article content</p>";
		const putObject = jest.fn().mockResolvedValue("s3://test-bucket/content/example.com%2Farticle/content.html");
		const updateContentLocation = jest.fn().mockResolvedValue({});
		const publishLinkSaved = jest.fn().mockResolvedValue({});

		const handler = initSaveLinkCommandHandler({
			findArticleContent,
			putObject,
			updateContentLocation,
			publishLinkSaved,
			logger: noopLogger,
		});

		await handler(createSqsEvent({ url: "https://example.com/article", userId: "user-1" }), stubContext, () => {});

		expect(putObject).toHaveBeenCalledTimes(1);
		expect(putObject).toHaveBeenCalledWith({
			key: expect.stringContaining("example.com"),
			content: "<p>Article content</p>",
		});

		expect(updateContentLocation).toHaveBeenCalledTimes(1);
		expect(updateContentLocation).toHaveBeenCalledWith({
			url: "https://example.com/article",
			contentLocation: expect.stringMatching(/^s3:\/\//),
		});

		expect(publishLinkSaved).toHaveBeenCalledTimes(1);
		expect(publishLinkSaved).toHaveBeenCalledWith({ url: "https://example.com/article", userId: "user-1" });
	});

	it("publishes LinkSavedEvent without S3 when article has no content", async () => {
		const findArticleContent: FindArticleContent = async () => undefined;
		const putObject = jest.fn();
		const updateContentLocation = jest.fn();
		const publishLinkSaved = jest.fn().mockResolvedValue({});

		const handler = initSaveLinkCommandHandler({
			findArticleContent,
			putObject,
			updateContentLocation,
			publishLinkSaved,
			logger: noopLogger,
		});

		await handler(createSqsEvent({ url: "https://example.com/no-content", userId: "user-1" }), stubContext, () => {});

		expect(putObject).not.toHaveBeenCalled();
		expect(updateContentLocation).not.toHaveBeenCalled();
		expect(publishLinkSaved).toHaveBeenCalledWith({ url: "https://example.com/no-content", userId: "user-1" });
	});

	it("throws on invalid event detail", async () => {
		const handler = initSaveLinkCommandHandler({
			findArticleContent: async () => "content",
			putObject: jest.fn(),
			updateContentLocation: jest.fn(),
			publishLinkSaved: jest.fn(),
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
				eventSourceARN: "arn:aws:sqs:ap-southeast-2:123456789:SaveLinkCommand",
				awsRegion: "ap-southeast-2",
			}],
		};

		await expect(
			handler(invalidEvent, stubContext, () => {}),
		).rejects.toThrow();
	});
});
