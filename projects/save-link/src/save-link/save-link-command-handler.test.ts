import posthtml from "posthtml";
import urls from "@11ty/posthtml-urls";
import { noopLogger } from "@packages/hutch-logger";
import { initSaveLinkCommandHandler } from "./save-link-command-handler";
import { initProcessContentWithLocalMedia } from "./process-content-with-local-media";
import type { ParseArticle } from "../article-parser/article-parser.types";
import type { DownloadMedia } from "./download-media";
import type { UpdateThumbnailUrl } from "./update-thumbnail-url";
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

const noopDownloadMedia: DownloadMedia = async () => [];

const processContent = initProcessContentWithLocalMedia({
	rewriteHtmlUrls: (html, rewriteUrl) => {
		const plugin = urls({ eachURL: rewriteUrl });
		return posthtml().use(plugin).process(html).then(result => result.html);
	},
});

const successfulParse: ParseArticle = async () => ({
	ok: true,
	article: { title: "Test", siteName: "example.com", excerpt: "test", wordCount: 10, content: "<p>Article content</p>" },
});

describe("initSaveLinkCommandHandler", () => {
	it("fetches article, saves content to S3, and publishes LinkSavedEvent", async () => {
		const putObject = jest.fn().mockResolvedValue("s3://test-bucket/content/example.com%2Farticle/content.html");
		const updateContentLocation = jest.fn().mockResolvedValue({});
		const publishLinkSaved = jest.fn().mockResolvedValue({});

		const handler = initSaveLinkCommandHandler({
			parseArticle: successfulParse,
			putObject,
			updateContentLocation,
			publishLinkSaved,
			downloadMedia: noopDownloadMedia,
			processContent,
			updateThumbnailUrl: jest.fn(),
			logger: noopLogger,
		});

		await handler(createSqsEvent({ url: "https://example.com/article", userId: "user-1" }), stubContext, () => {});

		expect(putObject).toHaveBeenCalledWith({
			key: expect.stringContaining("example.com"),
			content: "<p>Article content</p>",
		});

		expect(updateContentLocation).toHaveBeenCalledWith({
			url: "https://example.com/article",
			contentLocation: expect.stringMatching(/^s3:\/\//),
		});

		expect(publishLinkSaved).toHaveBeenCalledWith({ url: "https://example.com/article", userId: "user-1" });
	});

	it("skips content save and publishes event when article fetch fails", async () => {
		const failedParse: ParseArticle = async () => ({ ok: false, reason: "Could not fetch" });
		const putObject = jest.fn();
		const publishLinkSaved = jest.fn().mockResolvedValue({});

		const handler = initSaveLinkCommandHandler({
			parseArticle: failedParse,
			putObject,
			updateContentLocation: jest.fn(),
			publishLinkSaved,
			downloadMedia: noopDownloadMedia,
			processContent,
			updateThumbnailUrl: jest.fn(),
			logger: noopLogger,
		});

		await handler(createSqsEvent({ url: "https://example.com/unreachable", userId: "user-1" }), stubContext, () => {});

		expect(putObject).not.toHaveBeenCalled();
		expect(publishLinkSaved).toHaveBeenCalledWith({ url: "https://example.com/unreachable", userId: "user-1" });
	});

	it("throws on invalid event detail", async () => {
		const handler = initSaveLinkCommandHandler({
			parseArticle: successfulParse,
			putObject: jest.fn(),
			updateContentLocation: jest.fn(),
			publishLinkSaved: jest.fn(),
			downloadMedia: noopDownloadMedia,
			processContent,
			updateThumbnailUrl: jest.fn(),
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

	it("passes downloaded media through processContentWithLocalMedia to rewrite HTML", async () => {
		const parseWithImage: ParseArticle = async () => ({
			ok: true,
			article: { title: "T", siteName: "s", excerpt: "e", wordCount: 1, content: '<img src="https://example.com/img.png">' },
		});
		const downloadMedia: DownloadMedia = jest.fn().mockResolvedValue([
			{ originalUrl: "https://example.com/img.png", cdnUrl: "https://cdn/images/abc.png" },
		]);
		const putObject = jest.fn().mockResolvedValue("s3://bucket/key");

		const handler = initSaveLinkCommandHandler({
			parseArticle: parseWithImage,
			putObject,
			updateContentLocation: jest.fn().mockResolvedValue({}),
			publishLinkSaved: jest.fn().mockResolvedValue({}),
			downloadMedia,
			processContent,
			updateThumbnailUrl: jest.fn(),
			logger: noopLogger,
		});

		await handler(createSqsEvent({ url: "https://example.com/article", userId: "user-1" }), stubContext, () => {});

		expect(putObject).toHaveBeenCalledWith(
			expect.objectContaining({ content: expect.stringContaining("https://cdn/images/abc.png") }),
		);
	});

	it("updates thumbnail when media download rewrites it", async () => {
		const parseWithThumb: ParseArticle = async () => ({
			ok: true,
			article: { title: "T", siteName: "s", excerpt: "e", wordCount: 1, content: "<p>text</p>", imageUrl: "https://example.com/thumb.png" },
		});
		const downloadMedia: DownloadMedia = jest.fn().mockResolvedValue([
			{ originalUrl: "https://example.com/thumb.png", cdnUrl: "https://cdn/images/thumb.png" },
		]);
		const updateThumbnailUrl: UpdateThumbnailUrl = jest.fn().mockResolvedValue({});

		const handler = initSaveLinkCommandHandler({
			parseArticle: parseWithThumb,
			putObject: jest.fn().mockResolvedValue("s3://bucket/key"),
			updateContentLocation: jest.fn().mockResolvedValue({}),
			publishLinkSaved: jest.fn().mockResolvedValue({}),
			downloadMedia,
			processContent,
			updateThumbnailUrl,
			logger: noopLogger,
		});

		await handler(createSqsEvent({ url: "https://example.com/article", userId: "user-1" }), stubContext, () => {});

		expect(updateThumbnailUrl).toHaveBeenCalledWith({
			url: "https://example.com/article",
			imageUrl: "https://cdn/images/thumb.png",
		});
	});

	it("does not update thumbnail when no media was downloaded for it", async () => {
		const parseWithThumb: ParseArticle = async () => ({
			ok: true,
			article: { title: "T", siteName: "s", excerpt: "e", wordCount: 1, content: "<p>content</p>", imageUrl: "https://example.com/thumb.png" },
		});
		const updateThumbnailUrl: UpdateThumbnailUrl = jest.fn();

		const handler = initSaveLinkCommandHandler({
			parseArticle: parseWithThumb,
			putObject: jest.fn().mockResolvedValue("s3://bucket/key"),
			updateContentLocation: jest.fn().mockResolvedValue({}),
			publishLinkSaved: jest.fn().mockResolvedValue({}),
			downloadMedia: async () => [],
			processContent,
			updateThumbnailUrl,
			logger: noopLogger,
		});

		await handler(createSqsEvent({ url: "https://example.com/article", userId: "user-1" }), stubContext, () => {});

		expect(updateThumbnailUrl).not.toHaveBeenCalled();
	});
});
