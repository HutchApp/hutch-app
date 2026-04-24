import posthtml from "posthtml";
import urls from "@11ty/posthtml-urls";
import { noopLogger } from "@packages/hutch-logger";
import { initSaveLinkRawHtmlCommandHandler } from "./save-link-raw-html-command-handler";
import { initInMemorySourceContent } from "./in-memory-source-content";
import { initProcessContentWithLocalMedia } from "../save-link/process-content-with-local-media";
import type { ParseHtml } from "../article-parser/article-parser.types";
import type { DownloadMedia } from "../save-link/download-media";
import type { ReadPendingHtml } from "./read-pending-html";
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

function createSqsEvent(detail: { url: string; userId: string; title?: string }): SQSEvent {
	return {
		Records: [{
			messageId: "msg-1",
			receiptHandle: "receipt-1",
			body: JSON.stringify({ detail }),
			attributes: stubAttributes,
			messageAttributes: {},
			md5OfBody: "",
			eventSource: "aws:sqs",
			eventSourceARN: "arn:aws:sqs:ap-southeast-2:123456789:SaveLinkRawHtmlCommand",
			awsRegion: "ap-southeast-2",
		}],
	};
}

const noopDownloadMedia: DownloadMedia = async () => [];

const processContent = initProcessContentWithLocalMedia({
	rewriteHtmlUrls: (html, rewriteUrl) => {
		const plugin = urls({ eachURL: rewriteUrl });
		return posthtml().use(plugin).process(html).then((result) => result.html);
	},
});

const successfulParse: ParseHtml = () => ({
	ok: true,
	article: {
		title: "Test",
		siteName: "example.com",
		excerpt: "test",
		wordCount: 10,
		content: "<p>Article content</p>",
	},
});

type HandlerDeps = Parameters<typeof initSaveLinkRawHtmlCommandHandler>[0];

function createHandler(overrides: Partial<HandlerDeps> = {}) {
	const sourceContent = initInMemorySourceContent();
	return {
		handler: initSaveLinkRawHtmlCommandHandler({
			readPendingHtml: jest.fn().mockResolvedValue("<html><body><p>Article content</p></body></html>"),
			parseHtml: successfulParse,
			downloadMedia: noopDownloadMedia,
			processContent,
			putSourceContent: sourceContent.putSourceContent,
			logger: noopLogger,
			...overrides,
		}),
		readSourceContent: sourceContent.readSourceContent,
	};
}

describe("initSaveLinkRawHtmlCommandHandler", () => {
	it("reads pending html, parses, and writes the processed result to the tier-0 source key", async () => {
		const readPendingHtml: ReadPendingHtml = jest.fn().mockResolvedValue(
			"<html><body><p>Article content</p></body></html>",
		);
		const { handler, readSourceContent } = createHandler({ readPendingHtml });

		await handler(createSqsEvent({ url: "https://example.com/article", userId: "user-1" }), stubContext, () => {});

		expect(readPendingHtml).toHaveBeenCalledWith("https://example.com/article");
		expect(readSourceContent({ url: "https://example.com/article", tier: "tier-0" })).toBe("<p>Article content</p>");
	});

	it("does not write any other tier", async () => {
		const { handler, readSourceContent } = createHandler();

		await handler(createSqsEvent({ url: "https://example.com/article", userId: "user-1" }), stubContext, () => {});

		expect(readSourceContent({ url: "https://example.com/article", tier: "tier-1" })).toBeUndefined();
	});

	it("rewrites image URLs through downloadMedia + processContent", async () => {
		const parseWithImage: ParseHtml = () => ({
			ok: true,
			article: { title: "T", siteName: "s", excerpt: "e", wordCount: 1, content: '<img src="https://example.com/img.png">' },
		});
		const downloadMedia: DownloadMedia = jest.fn().mockResolvedValue([
			{ originalUrl: "https://example.com/img.png", cdnUrl: "https://cdn/images/abc.png" },
		]);
		const { handler, readSourceContent } = createHandler({ parseHtml: parseWithImage, downloadMedia });

		await handler(createSqsEvent({ url: "https://example.com/article", userId: "user-1" }), stubContext, () => {});

		expect(readSourceContent({ url: "https://example.com/article", tier: "tier-0" }))
			.toContain("https://cdn/images/abc.png");
	});

	it("rejects events whose detail does not match the SaveLinkRawHtmlCommand schema", async () => {
		const { handler } = createHandler();

		const invalidEvent: SQSEvent = {
			Records: [{
				messageId: "msg-1",
				receiptHandle: "receipt-1",
				body: JSON.stringify({ detail: { invalid: true } }),
				attributes: stubAttributes,
				messageAttributes: {},
				md5OfBody: "",
				eventSource: "aws:sqs",
				eventSourceARN: "arn:aws:sqs:ap-southeast-2:123456789:SaveLinkRawHtmlCommand",
				awsRegion: "ap-southeast-2",
			}],
		};

		await expect(handler(invalidEvent, stubContext, () => {})).rejects.toThrow();
	});

	it("throws when the parser rejects the captured html so SQS retries / DLQs the message", async () => {
		const failedParse: ParseHtml = () => ({ ok: false, reason: "no-readable-content" });
		const { handler, readSourceContent } = createHandler({ parseHtml: failedParse });

		await expect(
			handler(createSqsEvent({ url: "https://example.com/bad", userId: "user-1" }), stubContext, () => {}),
		).rejects.toThrow(/save-link-raw-html parse failed for https:\/\/example.com\/bad: no-readable-content/);

		expect(readSourceContent({ url: "https://example.com/bad", tier: "tier-0" })).toBeUndefined();
	});

	it("accepts an optional title in the command detail", async () => {
		const { handler, readSourceContent } = createHandler();

		await handler(
			createSqsEvent({ url: "https://example.com/article", userId: "user-1", title: "Captured Title" }),
			stubContext,
			() => {},
		);

		expect(readSourceContent({ url: "https://example.com/article", tier: "tier-0" })).toBe("<p>Article content</p>");
	});
});
