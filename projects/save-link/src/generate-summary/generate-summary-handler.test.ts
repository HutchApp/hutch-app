import { noopLogger } from "@packages/hutch-logger";
import { initGenerateSummaryHandler } from "./generate-summary-handler";
import type { SummarizeArticle } from "./article-summary.types";
import type { FindArticleContent } from "../save-link/find-article-content";
import type { PublishEvent } from "@packages/hutch-infra-components/runtime";
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

function createSqsEvent(command: { url: string }): SQSEvent {
	return {
		Records: [{
			messageId: "msg-1",
			receiptHandle: "receipt-1",
			body: JSON.stringify(command),
			attributes: stubAttributes,
			messageAttributes: {},
			md5OfBody: "",
			eventSource: "aws:sqs",
			eventSourceARN: "arn:aws:sqs:ap-southeast-2:123456789:GenerateGlobalSummary",
			awsRegion: "ap-southeast-2",
		}],
	};
}

describe("initGenerateSummaryHandler", () => {
	it("should summarize article and publish GlobalSummaryGenerated event", async () => {
		const summarizeArticle: SummarizeArticle = async () => ({
			summary: "A summary.",
			inputTokens: 100,
			outputTokens: 20,
		});
		const findArticleContent: FindArticleContent = async () => ({ content: "<p>Article content</p>" });
		const publishEvent: PublishEvent = jest.fn().mockResolvedValue(undefined);

		const handler = initGenerateSummaryHandler({
			summarizeArticle,
			findArticleContent,
			publishEvent,
			logger: noopLogger,
		});

		await handler(createSqsEvent({ url: "https://example.com/article" }), stubContext, () => {});

		expect(publishEvent).toHaveBeenCalledWith({
			source: "hutch.save-link",
			detailType: "GlobalSummaryGenerated",
			detail: JSON.stringify({
				url: "https://example.com/article",
				inputTokens: 100,
				outputTokens: 20,
			}),
		});
	});

	it("should throw when article content not found", async () => {
		const summarizeArticle: SummarizeArticle = async () => null;
		const findArticleContent: FindArticleContent = async () => undefined;
		const publishEvent: PublishEvent = jest.fn();

		const handler = initGenerateSummaryHandler({
			summarizeArticle,
			findArticleContent,
			publishEvent,
			logger: noopLogger,
		});

		await expect(
			handler(createSqsEvent({ url: "https://example.com/missing" }), stubContext, () => {}),
		).rejects.toThrow("Article content not found");
	});

	it("should skip publishing when summarization returns null (cache hit)", async () => {
		const summarizeArticle: SummarizeArticle = async () => null;
		const findArticleContent: FindArticleContent = async () => ({ content: "<p>Content</p>" });
		const publishEvent: PublishEvent = jest.fn();

		const handler = initGenerateSummaryHandler({
			summarizeArticle,
			findArticleContent,
			publishEvent,
			logger: noopLogger,
		});

		await handler(createSqsEvent({ url: "https://example.com/cached" }), stubContext, () => {});

		expect(publishEvent).not.toHaveBeenCalled();
	});

	it("should throw on invalid command schema", async () => {
		const summarizeArticle: SummarizeArticle = async () => null;
		const findArticleContent: FindArticleContent = async () => ({ content: "content" });
		const publishEvent: PublishEvent = jest.fn();

		const handler = initGenerateSummaryHandler({
			summarizeArticle,
			findArticleContent,
			publishEvent,
			logger: noopLogger,
		});

		const invalidEvent: SQSEvent = {
			Records: [{
				messageId: "msg-1",
				receiptHandle: "receipt-1",
				body: JSON.stringify({ invalid: true }),
				attributes: stubAttributes,
				messageAttributes: {},
				md5OfBody: "",
				eventSource: "aws:sqs",
				eventSourceARN: "arn:aws:sqs:ap-southeast-2:123456789:GenerateGlobalSummary",
				awsRegion: "ap-southeast-2",
			}],
		};

		await expect(
			handler(invalidEvent, stubContext, () => {}),
		).rejects.toThrow();
	});
});
