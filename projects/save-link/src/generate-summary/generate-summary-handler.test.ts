import { noopLogger } from "@packages/hutch-logger";
import { initGenerateSummaryHandler } from "./generate-summary-handler";
import type { SummarizeArticle } from "./article-summary.types";
import type { FindArticleContent } from "../save-link/find-article-content";
import type { PublishEvent } from "@packages/hutch-event-bridge/runtime";
import type { SQSEvent } from "aws-lambda";

function createSqsEvent(command: { url: string }): SQSEvent {
	return {
		Records: [{
			messageId: "msg-1",
			receiptHandle: "receipt-1",
			body: JSON.stringify(command),
			attributes: {} as SQSEvent["Records"][0]["attributes"],
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
		const findArticleContent: FindArticleContent = async () => "<p>Article content</p>";
		const publishEvent: PublishEvent = jest.fn().mockResolvedValue(undefined);

		const handler = initGenerateSummaryHandler({
			summarizeArticle,
			findArticleContent,
			publishEvent,
			logger: noopLogger,
		});

		await handler(createSqsEvent({ url: "https://example.com/article" }), {} as never, () => {});

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
			handler(createSqsEvent({ url: "https://example.com/missing" }), {} as never, () => {}),
		).rejects.toThrow("Article content not found");
	});

	it("should skip publishing when summarization returns null (cache hit)", async () => {
		const summarizeArticle: SummarizeArticle = async () => null;
		const findArticleContent: FindArticleContent = async () => "<p>Content</p>";
		const publishEvent: PublishEvent = jest.fn();

		const handler = initGenerateSummaryHandler({
			summarizeArticle,
			findArticleContent,
			publishEvent,
			logger: noopLogger,
		});

		await handler(createSqsEvent({ url: "https://example.com/cached" }), {} as never, () => {});

		expect(publishEvent).not.toHaveBeenCalled();
	});

	it("should throw on invalid command schema", async () => {
		const summarizeArticle: SummarizeArticle = async () => null;
		const findArticleContent: FindArticleContent = async () => "content";
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
				attributes: {} as SQSEvent["Records"][0]["attributes"],
				messageAttributes: {},
				md5OfBody: "",
				eventSource: "aws:sqs",
				eventSourceARN: "arn:aws:sqs:ap-southeast-2:123456789:GenerateGlobalSummary",
				awsRegion: "ap-southeast-2",
			}],
		};

		await expect(
			handler(invalidEvent, {} as never, () => {}),
		).rejects.toThrow();
	});
});
