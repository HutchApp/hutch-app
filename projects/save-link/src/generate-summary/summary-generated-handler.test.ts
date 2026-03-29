import { initSummaryGeneratedHandler } from "./summary-generated-handler";
import type { SQSEvent } from "aws-lambda";

function createSqsEvent(detail: { url: string; inputTokens: number; outputTokens: number }): SQSEvent {
	return {
		Records: [{
			messageId: "msg-1",
			receiptHandle: "receipt-1",
			body: JSON.stringify({ detail }),
			attributes: {} as SQSEvent["Records"][0]["attributes"],
			messageAttributes: {},
			md5OfBody: "",
			eventSource: "aws:sqs",
			eventSourceARN: "arn:aws:sqs:ap-southeast-2:123456789:GlobalSummaryGenerated",
			awsRegion: "ap-southeast-2",
		}],
	};
}

describe("initSummaryGeneratedHandler", () => {
	it("should log event data", async () => {
		const logger = {
			info: jest.fn(),
			error: jest.fn(),
			warn: jest.fn(),
			debug: jest.fn(),
		};

		const handler = initSummaryGeneratedHandler({ logger });

		await handler(createSqsEvent({
			url: "https://example.com/article",
			inputTokens: 150,
			outputTokens: 42,
		}), {} as never, () => {});

		expect(logger.info).toHaveBeenCalledWith("[GlobalSummaryGenerated]", {
			url: "https://example.com/article",
			inputTokens: 150,
			outputTokens: 42,
		});
	});

	it("should throw on invalid event detail", async () => {
		const logger = {
			info: jest.fn(),
			error: jest.fn(),
			warn: jest.fn(),
			debug: jest.fn(),
		};

		const handler = initSummaryGeneratedHandler({ logger });

		const invalidEvent: SQSEvent = {
			Records: [{
				messageId: "msg-1",
				receiptHandle: "receipt-1",
				body: JSON.stringify({ detail: { invalid: true } }),
				attributes: {} as SQSEvent["Records"][0]["attributes"],
				messageAttributes: {},
				md5OfBody: "",
				eventSource: "aws:sqs",
				eventSourceARN: "arn:aws:sqs:ap-southeast-2:123456789:GlobalSummaryGenerated",
				awsRegion: "ap-southeast-2",
			}],
		};

		await expect(
			handler(invalidEvent, {} as never, () => {}),
		).rejects.toThrow();
	});
});
