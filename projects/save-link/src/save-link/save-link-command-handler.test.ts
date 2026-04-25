import posthtml from "posthtml";
import urls from "@11ty/posthtml-urls";
import { noopLogger } from "@packages/hutch-logger";
import type { CrawlArticle } from "@packages/crawl-article";
import { initSaveLinkCommandHandler } from "./save-link-command-handler";
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

const successfulCrawl: CrawlArticle = async () => ({
	status: "fetched",
	html: "<html><body><p>Article content</p></body></html>",
});

const successfulParse: ParseHtml = () => ({
	ok: true,
	article: { title: "Test", siteName: "example.com", excerpt: "test", wordCount: 10, content: "<p>Article content</p>" },
});

const imagesCdnBaseUrl = "https://cdn.example.com";

type HandlerDeps = Parameters<typeof initSaveLinkCommandHandler>[0];

const fixedNow = () => new Date("2026-04-18T12:00:00.000Z");

function createHandler(overrides: Partial<HandlerDeps> = {}) {
	return initSaveLinkCommandHandler({
		crawlArticle: successfulCrawl,
		parseHtml: successfulParse,
		putObject: jest.fn().mockResolvedValue("s3://bucket/key"),
		putImageObject: jest.fn().mockResolvedValue(undefined),
		updateContentLocation: jest.fn().mockResolvedValue(undefined),
		updateFetchTimestamp: jest.fn().mockResolvedValue(undefined),
		updateArticleMetadata: jest.fn().mockResolvedValue(undefined),
		markCrawlReady: jest.fn().mockResolvedValue(undefined),
		markCrawlFailed: jest.fn().mockResolvedValue(undefined),
		publishLinkSaved: jest.fn().mockResolvedValue(undefined),
		publishEvent: jest.fn().mockResolvedValue(undefined),
		downloadMedia: noopDownloadMedia,
		processContent,
		updateThumbnailUrl: jest.fn().mockResolvedValue(undefined),
		imagesCdnBaseUrl,
		now: fixedNow,
		logger: noopLogger,
		logParseError: jest.fn(),
		logCrawlOutcome: jest.fn(),
		readTierSnapshot: jest.fn().mockResolvedValue({ tier0Status: "not_attempted", tier1Status: "not_attempted", pickedTier: "none" }),
		...overrides,
	});
}

describe("initSaveLinkCommandHandler", () => {
	it("fetches article, saves content to S3, and publishes LinkSavedEvent", async () => {
		const putObject = jest.fn().mockResolvedValue("s3://test-bucket/content/example.com%2Farticle/content.html");
		const updateContentLocation = jest.fn().mockResolvedValue(undefined);
		const publishLinkSaved = jest.fn().mockResolvedValue(undefined);

		const handler = createHandler({ putObject, updateContentLocation, publishLinkSaved });

		await handler(createSqsEvent({ url: "https://example.com/article", userId: "user-1" }), stubContext, () => {});

		expect(putObject).toHaveBeenCalledWith({
			key: expect.stringContaining("example.com"),
			content: "<p>Article content</p>",
		});

		expect(updateContentLocation).toHaveBeenCalledWith({
			url: "https://example.com/article",
			contentLocation: expect.stringMatching(/^s3:\/\//),
			tier: "tier-1",
		});

		expect(publishLinkSaved).toHaveBeenCalledWith({ url: "https://example.com/article", userId: "user-1" });
	});

	it("writes parsed metadata to the article row before publishing", async () => {
		const updateArticleMetadata = jest.fn().mockResolvedValue(undefined);
		const parseHtml: ParseHtml = () => ({
			ok: true,
			article: {
				title: "Real Title",
				siteName: "Example",
				excerpt: "An excerpt.",
				wordCount: 480,
				content: "<p>body</p>",
				imageUrl: "https://example.com/og.png",
			},
		});

		const handler = createHandler({ updateArticleMetadata, parseHtml });

		await handler(createSqsEvent({ url: "https://example.com/article", userId: "user-1" }), stubContext, () => {});

		expect(updateArticleMetadata).toHaveBeenCalledWith({
			url: "https://example.com/article",
			title: "Real Title",
			siteName: "Example",
			excerpt: "An excerpt.",
			wordCount: 480,
			estimatedReadTime: 3,
			imageUrl: "https://example.com/og.png",
		});
	});

	it("marks the crawl ready and publishes CrawlArticleCompletedEvent on success", async () => {
		const markCrawlReady = jest.fn().mockResolvedValue(undefined);
		const publishEvent = jest.fn().mockResolvedValue(undefined);

		const handler = createHandler({ markCrawlReady, publishEvent });

		await handler(createSqsEvent({ url: "https://example.com/article", userId: "user-1" }), stubContext, () => {});

		expect(markCrawlReady).toHaveBeenCalledWith({ url: "https://example.com/article" });
		expect(publishEvent).toHaveBeenCalledWith({
			source: "hutch.save-link",
			detailType: "CrawlArticleCompleted",
			detail: JSON.stringify({ url: "https://example.com/article" }),
		});
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

		await handler(createSqsEvent({ url: "https://example.com/article", userId: "user-1" }), stubContext, () => {});

		expect(updateFetchTimestamp).toHaveBeenCalledWith({
			url: "https://example.com/article",
			contentFetchedAt: "2026-04-18T12:00:00.000Z",
			etag: '"abc123"',
			lastModified: "Wed, 15 Apr 2026 10:00:00 GMT",
		});
	});

	it("does not record the fetch timestamp when the crawl failed", async () => {
		const updateFetchTimestamp = jest.fn().mockResolvedValue(undefined);
		const failedCrawl: CrawlArticle = async () => ({ status: "failed" });

		const handler = createHandler({ crawlArticle: failedCrawl, updateFetchTimestamp });

		await expect(
			handler(createSqsEvent({ url: "https://example.com/unreachable", userId: "user-1" }), stubContext, () => {}),
		).rejects.toThrow();

		expect(updateFetchTimestamp).not.toHaveBeenCalled();
	});

	it("reports crawl failures via logParseError with the crawl status as reason and rethrows for SQS retry", async () => {
		const logParseError = jest.fn();
		const failedCrawl: CrawlArticle = async () => ({ status: "failed" });

		const handler = createHandler({ crawlArticle: failedCrawl, logParseError });

		await expect(
			handler(createSqsEvent({ url: "https://example.com/unreachable", userId: "user-1" }), stubContext, () => {}),
		).rejects.toThrow();

		expect(logParseError).toHaveBeenCalledWith({
			url: "https://example.com/unreachable",
			reason: "crawl-failed",
		});
	});

	it("reports parse failures via logParseError with the parser's reason and rethrows for SQS retry", async () => {
		const logParseError = jest.fn();
		const failedParse: ParseHtml = () => ({ ok: false, reason: "Invalid URL" });

		const handler = createHandler({ parseHtml: failedParse, logParseError });

		await expect(
			handler(createSqsEvent({ url: "https://example.com/bad", userId: "user-1" }), stubContext, () => {}),
		).rejects.toThrow();

		expect(logParseError).toHaveBeenCalledWith({
			url: "https://example.com/bad",
			reason: "Invalid URL",
		});
	});

	it("reports post-parse step failures via logParseError so S3 / DynamoDB / thumbnail errors surface in the parse-errors widget instead of being buried in raw Lambda logs", async () => {
		const logParseError = jest.fn();
		const putObject = jest.fn().mockRejectedValue(new Error("S3 PutObject AccessDenied"));

		const handler = createHandler({ putObject, logParseError });

		await expect(
			handler(createSqsEvent({ url: "https://example.com/article", userId: "user-1" }), stubContext, () => {}),
		).rejects.toThrow("S3 PutObject AccessDenied");

		expect(logParseError).toHaveBeenCalledWith({
			url: "https://example.com/article",
			reason: "post-parse-step-failed: S3 PutObject AccessDenied",
		});
	});

	it("stringifies non-Error throws from a post-parse step into the parse-errors reason", async () => {
		const logParseError = jest.fn();
		const putObject = jest.fn().mockRejectedValue("bare-string-thrown");

		const handler = createHandler({ putObject, logParseError });

		await expect(
			handler(createSqsEvent({ url: "https://example.com/article", userId: "user-1" }), stubContext, () => {}),
		).rejects.toBe("bare-string-thrown");

		expect(logParseError).toHaveBeenCalledWith({
			url: "https://example.com/article",
			reason: "post-parse-step-failed: bare-string-thrown",
		});
	});

	it("emits a tier-1 success crawl-outcome on successful save, snapshotting the other tier's state", async () => {
		const logCrawlOutcome = jest.fn();
		const readTierSnapshot = jest.fn().mockResolvedValue({
			tier0Status: "success",
			tier1Status: "success",
			pickedTier: "tier-1",
		});

		const handler = createHandler({ logCrawlOutcome, readTierSnapshot });

		await handler(createSqsEvent({ url: "https://example.com/article", userId: "user-1" }), stubContext, () => {});

		expect(logCrawlOutcome).toHaveBeenCalledWith({
			url: "https://example.com/article",
			thisTier: "tier-1",
			thisTierStatus: "success",
			otherTierStatus: "success",
			pickedTier: "tier-1",
		});
	});

	it("emits a tier-1 failure crawl-outcome when the crawl fails, reflecting tier-0's snapshot at emission time", async () => {
		const logCrawlOutcome = jest.fn();
		const readTierSnapshot = jest.fn().mockResolvedValue({
			tier0Status: "success",
			tier1Status: "not_attempted",
			pickedTier: "tier-0",
		});
		const failedCrawl: CrawlArticle = async () => ({ status: "failed" });

		const handler = createHandler({ crawlArticle: failedCrawl, logCrawlOutcome, readTierSnapshot });

		await expect(
			handler(createSqsEvent({ url: "https://example.com/unreachable", userId: "user-1" }), stubContext, () => {}),
		).rejects.toThrow();

		expect(logCrawlOutcome).toHaveBeenCalledWith({
			url: "https://example.com/unreachable",
			thisTier: "tier-1",
			thisTierStatus: "failed",
			otherTierStatus: "success",
			pickedTier: "tier-0",
		});
	});

	it("emits a tier-1 failure crawl-outcome when the parse fails and marks the other tier as not-attempted when tier-0 never captured", async () => {
		const logCrawlOutcome = jest.fn();
		const readTierSnapshot = jest.fn().mockResolvedValue({
			tier0Status: "not_attempted",
			tier1Status: "failed",
			pickedTier: "none",
		});
		const failedParse: ParseHtml = () => ({ ok: false, reason: "Readability crashed" });

		const handler = createHandler({ parseHtml: failedParse, logCrawlOutcome, readTierSnapshot });

		await expect(
			handler(createSqsEvent({ url: "https://example.com/bad", userId: "user-1" }), stubContext, () => {}),
		).rejects.toThrow();

		expect(logCrawlOutcome).toHaveBeenCalledWith({
			url: "https://example.com/bad",
			thisTier: "tier-1",
			thisTierStatus: "failed",
			otherTierStatus: "not_attempted",
			pickedTier: "none",
		});
	});

	it("opts into thumbnail fetching when calling crawlArticle", async () => {
		const crawlArticle = jest.fn<ReturnType<CrawlArticle>, Parameters<CrawlArticle>>().mockResolvedValue({
			status: "fetched",
			html: "<html><body><p>Article content</p></body></html>",
		});

		const handler = createHandler({ crawlArticle });

		await handler(createSqsEvent({ url: "https://example.com/article", userId: "user-1" }), stubContext, () => {});

		expect(crawlArticle).toHaveBeenCalledWith({
			url: "https://example.com/article",
			fetchThumbnail: true,
		});
	});

	it("skips content save and does not publish events when the article fetch fails (DLQ owns the failure path)", async () => {
		const failedCrawl: CrawlArticle = async () => ({ status: "failed" });
		const putObject = jest.fn();
		const publishLinkSaved = jest.fn().mockResolvedValue(undefined);
		const publishEvent = jest.fn().mockResolvedValue(undefined);
		const markCrawlReady = jest.fn().mockResolvedValue(undefined);

		const handler = createHandler({ crawlArticle: failedCrawl, putObject, publishLinkSaved, publishEvent, markCrawlReady });

		await expect(
			handler(createSqsEvent({ url: "https://example.com/unreachable", userId: "user-1" }), stubContext, () => {}),
		).rejects.toThrow();

		expect(putObject).not.toHaveBeenCalled();
		expect(publishLinkSaved).not.toHaveBeenCalled();
		expect(publishEvent).not.toHaveBeenCalled();
		expect(markCrawlReady).not.toHaveBeenCalled();
	});

	it("marks the crawl 'failed' immediately when parsing fails, so readers and the Tier 1+ canary see the terminal state without waiting ~90s for SQS retries → DLQ", async () => {
		const markCrawlFailed = jest.fn().mockResolvedValue(undefined);
		const failedParse: ParseHtml = () => ({ ok: false, reason: "Readability crashed on this DOM" });

		const handler = createHandler({ parseHtml: failedParse, markCrawlFailed });

		await expect(
			handler(createSqsEvent({ url: "https://example.com/bad", userId: "user-1" }), stubContext, () => {}),
		).rejects.toThrow("crawl failed for https://example.com/bad: Readability crashed on this DOM");

		expect(markCrawlFailed).toHaveBeenCalledWith({
			url: "https://example.com/bad",
			reason: "Readability crashed on this DOM",
		});
	});

	it("does NOT mark crawl 'failed' on a crawl-fetch failure — transient fetch issues stay on the SQS retry / DLQ path, which can recover if the origin transiently 5xx'd", async () => {
		const markCrawlFailed = jest.fn().mockResolvedValue(undefined);
		const failedCrawl: CrawlArticle = async () => ({ status: "failed" });

		const handler = createHandler({ crawlArticle: failedCrawl, markCrawlFailed });

		await expect(
			handler(createSqsEvent({ url: "https://example.com/unreachable", userId: "user-1" }), stubContext, () => {}),
		).rejects.toThrow();

		expect(markCrawlFailed).not.toHaveBeenCalled();
	});

	it("skips content save and does not publish events when the article parse fails (DLQ owns the failure path)", async () => {
		const failedParse: ParseHtml = () => ({ ok: false, reason: "Invalid URL" });
		const putObject = jest.fn();
		const publishLinkSaved = jest.fn().mockResolvedValue(undefined);
		const publishEvent = jest.fn().mockResolvedValue(undefined);
		const markCrawlReady = jest.fn().mockResolvedValue(undefined);

		const handler = createHandler({ parseHtml: failedParse, putObject, publishLinkSaved, publishEvent, markCrawlReady });

		await expect(
			handler(createSqsEvent({ url: "https://example.com/bad", userId: "user-1" }), stubContext, () => {}),
		).rejects.toThrow();

		expect(putObject).not.toHaveBeenCalled();
		expect(publishLinkSaved).not.toHaveBeenCalled();
		expect(publishEvent).not.toHaveBeenCalled();
		expect(markCrawlReady).not.toHaveBeenCalled();
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
				eventSourceARN: "arn:aws:sqs:ap-southeast-2:123456789:SaveLinkCommand",
				awsRegion: "ap-southeast-2",
			}],
		};

		await expect(
			handler(invalidEvent, stubContext, () => {}),
		).rejects.toThrow();
	});

	it("passes downloaded media through processContentWithLocalMedia to rewrite HTML", async () => {
		const parseWithImage: ParseHtml = () => ({
			ok: true,
			article: { title: "T", siteName: "s", excerpt: "e", wordCount: 1, content: '<img src="https://example.com/img.png">' },
		});
		const downloadMedia: DownloadMedia = jest.fn().mockResolvedValue([
			{ originalUrl: "https://example.com/img.png", cdnUrl: "https://cdn/images/abc.png" },
		]);
		const putObject = jest.fn().mockResolvedValue("s3://bucket/key");

		const handler = createHandler({ parseHtml: parseWithImage, downloadMedia, putObject });

		await handler(createSqsEvent({ url: "https://example.com/article", userId: "user-1" }), stubContext, () => {});

		expect(putObject).toHaveBeenCalledWith(
			expect.objectContaining({ content: expect.stringContaining("https://cdn/images/abc.png") }),
		);
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

		await handler(createSqsEvent({ url: "https://example.com/article", userId: "user-1" }), stubContext, () => {});

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

	it("does not upload or update the thumbnail when the crawler did not return one", async () => {
		const putImageObject: PutImageObject = jest.fn().mockResolvedValue(undefined);
		const updateThumbnailUrl: UpdateThumbnailUrl = jest.fn().mockResolvedValue(undefined);

		const handler = createHandler({ putImageObject, updateThumbnailUrl });

		await handler(createSqsEvent({ url: "https://example.com/article", userId: "user-1" }), stubContext, () => {});

		expect(putImageObject).not.toHaveBeenCalled();
		expect(updateThumbnailUrl).not.toHaveBeenCalled();
	});

	it("derives the thumbnail filename from the original URL and content-type", async () => {
		const crawlArticle: CrawlArticle = async () => ({
			status: "fetched",
			html: "<html></html>",
			thumbnailImage: {
				body: Buffer.from("png-bytes"),
				contentType: "image/png",
				url: "https://cdn.example.com/different.png",
				extension: ".png",
			},
		});
		const putImageObject: PutImageObject = jest.fn().mockResolvedValue(undefined);

		const handler = createHandler({ crawlArticle, putImageObject });

		await handler(createSqsEvent({ url: "https://example.com/article", userId: "user-1" }), stubContext, () => {});

		expect(putImageObject).toHaveBeenCalledWith(
			expect.objectContaining({
				key: expect.stringMatching(/\.png$/),
				contentType: "image/png",
			}),
		);
	});
});
