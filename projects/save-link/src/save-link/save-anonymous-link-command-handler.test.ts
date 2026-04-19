import posthtml from "posthtml";
import urls from "@11ty/posthtml-urls";
import { noopLogger } from "@packages/hutch-logger";
import type { CrawlArticle } from "@packages/crawl-article";
import { initSaveAnonymousLinkCommandHandler } from "./save-anonymous-link-command-handler";
import { initProcessContentWithLocalMedia } from "./process-content-with-local-media";
import type { ParseHtml } from "../article-parser/article-parser.types";
import type { DownloadMedia } from "./download-media";
import type { PutImageObject } from "./s3-put-image-object";
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
			eventSourceARN: "arn:aws:sqs:ap-southeast-2:123456789:SaveAnonymousLinkCommand",
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

const successfulCrawl: CrawlArticle = async () => ({
	status: "fetched",
	html: "<html><body><p>Article content</p></body></html>",
});

const successfulParse: ParseHtml = () => ({
	ok: true,
	article: { title: "Test", siteName: "example.com", excerpt: "test", wordCount: 10, content: "<p>Article content</p>" },
});

const imagesCdnBaseUrl = "https://cdn.example.com";

type HandlerDeps = Parameters<typeof initSaveAnonymousLinkCommandHandler>[0];

const fixedNow = () => new Date("2026-04-18T12:00:00.000Z");

function createHandler(overrides: Partial<HandlerDeps> = {}) {
	return initSaveAnonymousLinkCommandHandler({
		crawlArticle: successfulCrawl,
		parseHtml: successfulParse,
		putObject: jest.fn().mockResolvedValue("s3://bucket/key"),
		putImageObject: jest.fn().mockResolvedValue(undefined),
		updateContentLocation: jest.fn().mockResolvedValue(undefined),
		updateFetchTimestamp: jest.fn().mockResolvedValue(undefined),
		publishAnonymousLinkSaved: jest.fn().mockResolvedValue(undefined),
		downloadMedia: noopDownloadMedia,
		processContent,
		updateThumbnailUrl: jest.fn().mockResolvedValue(undefined),
		imagesCdnBaseUrl,
		now: fixedNow,
		logger: noopLogger,
		logParseError: jest.fn(),
		...overrides,
	});
}

describe("initSaveAnonymousLinkCommandHandler", () => {
	it("fetches article, saves content to S3, and publishes AnonymousLinkSavedEvent with the url only", async () => {
		const putObject = jest.fn().mockResolvedValue("s3://test-bucket/content/example.com%2Farticle/content.html");
		const updateContentLocation = jest.fn().mockResolvedValue(undefined);
		const publishAnonymousLinkSaved = jest.fn().mockResolvedValue(undefined);

		const handler = createHandler({ putObject, updateContentLocation, publishAnonymousLinkSaved });

		await handler(createSqsEvent({ url: "https://example.com/article" }), stubContext, () => {});

		expect(putObject).toHaveBeenCalledWith({
			key: expect.stringContaining("example.com"),
			content: "<p>Article content</p>",
		});
		expect(updateContentLocation).toHaveBeenCalledWith({
			url: "https://example.com/article",
			contentLocation: expect.stringMatching(/^s3:\/\//),
		});
		expect(publishAnonymousLinkSaved).toHaveBeenCalledWith({ url: "https://example.com/article" });
	});

	it("records contentFetchedAt + etag + lastModified after successful crawl so later saves skip the re-crawl", async () => {
		const updateFetchTimestamp = jest.fn().mockResolvedValue(undefined);
		const crawlArticle: CrawlArticle = async () => ({
			status: "fetched",
			html: "<html><body><p>Article content</p></body></html>",
			etag: '"abc123"',
			lastModified: "Wed, 15 Apr 2026 10:00:00 GMT",
		});

		const handler = createHandler({ crawlArticle, updateFetchTimestamp });

		await handler(createSqsEvent({ url: "https://example.com/article" }), stubContext, () => {});

		expect(updateFetchTimestamp).toHaveBeenCalledWith({
			url: "https://example.com/article",
			contentFetchedAt: "2026-04-18T12:00:00.000Z",
			etag: '"abc123"',
			lastModified: "Wed, 15 Apr 2026 10:00:00 GMT",
		});
	});

	it("passes undefined etag/lastModified when the origin omitted them", async () => {
		const updateFetchTimestamp = jest.fn().mockResolvedValue(undefined);

		const handler = createHandler({ updateFetchTimestamp });

		await handler(createSqsEvent({ url: "https://example.com/article" }), stubContext, () => {});

		expect(updateFetchTimestamp).toHaveBeenCalledWith({
			url: "https://example.com/article",
			contentFetchedAt: "2026-04-18T12:00:00.000Z",
			etag: undefined,
			lastModified: undefined,
		});
	});

	it("does not record the fetch timestamp when the crawl failed", async () => {
		const updateFetchTimestamp = jest.fn().mockResolvedValue(undefined);
		const failedCrawl: CrawlArticle = async () => ({ status: "failed" });

		const handler = createHandler({ crawlArticle: failedCrawl, updateFetchTimestamp });

		await handler(createSqsEvent({ url: "https://example.com/unreachable" }), stubContext, () => {});

		expect(updateFetchTimestamp).not.toHaveBeenCalled();
	});

	it("reports crawl failures via logParseError with the crawl status as reason", async () => {
		const logParseError = jest.fn();
		const failedCrawl: CrawlArticle = async () => ({ status: "failed" });

		const handler = createHandler({ crawlArticle: failedCrawl, logParseError });

		await handler(createSqsEvent({ url: "https://example.com/unreachable" }), stubContext, () => {});

		expect(logParseError).toHaveBeenCalledWith({
			url: "https://example.com/unreachable",
			reason: "crawl-failed",
		});
	});

	it("reports parse failures via logParseError with the parser's reason", async () => {
		const logParseError = jest.fn();
		const failedParse: ParseHtml = () => ({ ok: false, reason: "Invalid URL" });

		const handler = createHandler({ parseHtml: failedParse, logParseError });

		await handler(createSqsEvent({ url: "https://example.com/bad" }), stubContext, () => {});

		expect(logParseError).toHaveBeenCalledWith({
			url: "https://example.com/bad",
			reason: "Invalid URL",
		});
	});

	it("skips content save and still publishes the event when the article fetch fails", async () => {
		const failedCrawl: CrawlArticle = async () => ({ status: "failed" });
		const putObject = jest.fn();
		const publishAnonymousLinkSaved = jest.fn().mockResolvedValue(undefined);

		const handler = createHandler({ crawlArticle: failedCrawl, putObject, publishAnonymousLinkSaved });

		await handler(createSqsEvent({ url: "https://example.com/unreachable" }), stubContext, () => {});

		expect(putObject).not.toHaveBeenCalled();
		expect(publishAnonymousLinkSaved).toHaveBeenCalledWith({ url: "https://example.com/unreachable" });
	});

	it("skips content save and still publishes the event when parsing fails", async () => {
		const failedParse: ParseHtml = () => ({ ok: false, reason: "Invalid URL" });
		const putObject = jest.fn();
		const publishAnonymousLinkSaved = jest.fn().mockResolvedValue(undefined);

		const handler = createHandler({ parseHtml: failedParse, putObject, publishAnonymousLinkSaved });

		await handler(createSqsEvent({ url: "https://example.com/bad" }), stubContext, () => {});

		expect(putObject).not.toHaveBeenCalled();
		expect(publishAnonymousLinkSaved).toHaveBeenCalledWith({ url: "https://example.com/bad" });
	});

	it("throws on invalid event detail", async () => {
		const handler = createHandler();

		const invalidEvent: SQSEvent = {
			Records: [{
				messageId: "msg-1",
				receiptHandle: "receipt-1",
				body: JSON.stringify({ detail: { invalid: true } }),
				attributes: stubAttributes,
				messageAttributes: {},
				md5OfBody: "",
				eventSource: "aws:sqs",
				eventSourceARN: "arn:aws:sqs:ap-southeast-2:123456789:SaveAnonymousLinkCommand",
				awsRegion: "ap-southeast-2",
			}],
		};

		await expect(
			handler(invalidEvent, stubContext, () => {}),
		).rejects.toThrow();
	});

	it("uploads the crawled thumbnail to S3 and updates the DynamoDB imageUrl", async () => {
		const imageBody = Buffer.from([0xff, 0xd8, 0xff]);
		const crawlArticle: CrawlArticle = async () => ({
			status: "fetched",
			html: "<html></html>",
			thumbnailImage: {
				body: imageBody,
				contentType: "image/jpeg",
				url: "https://cdn.example.com/thumb.jpg",
				extension: ".jpg",
			},
		});
		const putImageObject: PutImageObject = jest.fn().mockResolvedValue(undefined);
		const updateThumbnailUrl: UpdateThumbnailUrl = jest.fn().mockResolvedValue(undefined);

		const handler = createHandler({ crawlArticle, putImageObject, updateThumbnailUrl });

		await handler(createSqsEvent({ url: "https://example.com/article" }), stubContext, () => {});

		expect(putImageObject).toHaveBeenCalledWith({
			key: expect.stringMatching(/^content\/example\.com%2Farticle\/images\/[0-9a-f]{16}\.jpg$/),
			body: imageBody,
			contentType: "image/jpeg",
		});
		expect(updateThumbnailUrl).toHaveBeenCalledWith({
			url: "https://example.com/article",
			imageUrl: expect.stringMatching(/^https:\/\/cdn\.example\.com\/content\/example\.com%252Farticle\/images\/[0-9a-f]{16}\.jpg$/),
		});
	});
});
