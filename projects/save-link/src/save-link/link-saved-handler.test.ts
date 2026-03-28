import { noopLogger } from "@packages/hutch-logger";
import { initLinkSavedHandler } from "./link-saved-handler";
import type { FindArticleContent } from "./find-article-content";
import type { SQSEvent } from "aws-lambda";

function createSqsEvent(detail: { url: string; userId: string }): SQSEvent {
	return {
		Records: [{
			messageId: "msg-1",
			receiptHandle: "receipt-1",
			body: JSON.stringify({ detail }),
			attributes: {} as SQSEvent["Records"][0]["attributes"],
			messageAttributes: {},
			md5OfBody: "",
			eventSource: "aws:sqs",
			eventSourceARN: "arn:aws:sqs:ap-southeast-2:123456789:LinkSaved",
			awsRegion: "ap-southeast-2",
		}],
	};
}

describe("initLinkSavedHandler", () => {
	it("should send GenerateGlobalSummary command when article has content", async () => {
		const sendMessage = jest.fn().mockResolvedValue({});
		const sqsClient = { send: sendMessage } as unknown as import("@aws-sdk/client-sqs").SQSClient;
		const findArticleContent: FindArticleContent = async () => "<p>Some content</p>";

		const handler = initLinkSavedHandler({
			sqsClient,
			queueUrl: "https://sqs.ap-southeast-2.amazonaws.com/123/GenerateGlobalSummary",
			findArticleContent,
			logger: noopLogger,
		});

		await handler(createSqsEvent({ url: "https://example.com/article", userId: "user-1" }), {} as never, () => {});

		expect(sendMessage).toHaveBeenCalledTimes(1);
		const command = sendMessage.mock.calls[0][0];
		expect(JSON.parse(command.input.MessageBody)).toEqual({ url: "https://example.com/article" });
	});

	it("should throw when article has no content", async () => {
		const sqsClient = { send: jest.fn() } as unknown as import("@aws-sdk/client-sqs").SQSClient;
		const findArticleContent: FindArticleContent = async () => undefined;

		const handler = initLinkSavedHandler({
			sqsClient,
			queueUrl: "https://sqs.ap-southeast-2.amazonaws.com/123/GenerateGlobalSummary",
			findArticleContent,
			logger: noopLogger,
		});

		await expect(
			handler(createSqsEvent({ url: "https://example.com/no-content", userId: "user-1" }), {} as never, () => {}),
		).rejects.toThrow("Article has no content: https://example.com/no-content");
	});

	it("should throw on invalid event detail", async () => {
		const sqsClient = { send: jest.fn() } as unknown as import("@aws-sdk/client-sqs").SQSClient;
		const findArticleContent: FindArticleContent = async () => "content";

		const handler = initLinkSavedHandler({
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
				attributes: {} as SQSEvent["Records"][0]["attributes"],
				messageAttributes: {},
				md5OfBody: "",
				eventSource: "aws:sqs",
				eventSourceARN: "arn:aws:sqs:ap-southeast-2:123456789:LinkSaved",
				awsRegion: "ap-southeast-2",
			}],
		};

		await expect(
			handler(invalidEvent, {} as never, () => {}),
		).rejects.toThrow();
	});
});
