import posthtml from "posthtml";
import urls from "@11ty/posthtml-urls";
import { noopLogger } from "@packages/hutch-logger";
import { initSaveLinkRawHtmlCommandHandler } from "./save-link-raw-html-command-handler";
import { initInMemorySourceContent } from "./in-memory-source-content";
import { initInMemoryCanonicalContent } from "./in-memory-canonical-content";
import { initProcessContentWithLocalMedia } from "../save-link/process-content-with-local-media";
import type { ParseHtml } from "../article-parser/article-parser.types";
import type { DownloadMedia } from "../save-link/download-media";
import type { ReadPendingHtml } from "./read-pending-html";
import type { SelectMostCompleteContent } from "./select-content";
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

const tierZeroWinsSelector: SelectMostCompleteContent = async () => ({
	winner: "tier-0",
	reason: "tier-0 has more prose",
});

const canonicalWinsSelector: SelectMostCompleteContent = async () => ({
	winner: "canonical",
	reason: "canonical is better",
});

type HandlerDeps = Parameters<typeof initSaveLinkRawHtmlCommandHandler>[0];

function createHandler(overrides: Partial<HandlerDeps> = {}) {
	const sourceContent = initInMemorySourceContent();
	const canonicalContent = initInMemoryCanonicalContent({
		readSourceContent: sourceContent.readSourceContent,
	});
	const deps: HandlerDeps = {
		readPendingHtml: jest.fn().mockResolvedValue("<html><body><p>Article content</p></body></html>"),
		parseHtml: successfulParse,
		downloadMedia: noopDownloadMedia,
		processContent,
		putSourceContent: sourceContent.putSourceContent,
		readCanonicalContent: canonicalContent.readCanonicalContent,
		promoteSourceToCanonical: canonicalContent.promoteSourceToCanonical,
		selectMostCompleteContent: jest.fn(tierZeroWinsSelector),
		publishLinkSaved: jest.fn().mockResolvedValue(undefined),
		markCrawlReady: jest.fn().mockResolvedValue(undefined),
		markCrawlFailed: jest.fn().mockResolvedValue(undefined),
		logParseError: jest.fn(),
		logger: noopLogger,
		...overrides,
	};
	return {
		handler: initSaveLinkRawHtmlCommandHandler(deps),
		readSourceContent: sourceContent.readSourceContent,
		readCanonicalContent: canonicalContent.readCanonicalContent,
		seedCanonical: canonicalContent.seedCanonical,
		publishLinkSaved: deps.publishLinkSaved as jest.Mock,
		selectMostCompleteContent: deps.selectMostCompleteContent as jest.Mock,
		markCrawlReady: deps.markCrawlReady as jest.Mock,
		markCrawlFailed: deps.markCrawlFailed as jest.Mock,
		logParseError: deps.logParseError as jest.Mock,
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

	it("marks the crawl failed and re-throws on parser rejection so the reader sees failed at t+0 while SQS still retries / DLQs the message", async () => {
		const failedParse: ParseHtml = () => ({ ok: false, reason: "no-readable-content" });
		const { handler, readSourceContent, markCrawlFailed, markCrawlReady } = createHandler({ parseHtml: failedParse });

		await expect(
			handler(createSqsEvent({ url: "https://example.com/bad", userId: "user-1" }), stubContext, () => {}),
		).rejects.toThrow(/save-link-raw-html parse failed for https:\/\/example.com\/bad: no-readable-content/);

		expect(markCrawlFailed).toHaveBeenCalledWith({
			url: "https://example.com/bad",
			reason: "no-readable-content",
		});
		expect(markCrawlReady).not.toHaveBeenCalled();
		expect(readSourceContent({ url: "https://example.com/bad", tier: "tier-0" })).toBeUndefined();
	});

	it("reports parse failures via logParseError with the parser's reason so the dashboard parse-errors widget surfaces tier-0 failures", async () => {
		const failedParse: ParseHtml = () => ({ ok: false, reason: "no-readable-content" });
		const { handler, logParseError } = createHandler({ parseHtml: failedParse });

		await expect(
			handler(createSqsEvent({ url: "https://example.com/bad", userId: "user-1" }), stubContext, () => {}),
		).rejects.toThrow();

		expect(logParseError).toHaveBeenCalledWith({
			url: "https://example.com/bad",
			reason: "no-readable-content",
		});
	});

	it("logs the extension-captured title alongside the tier-0 save for debuggability", async () => {
		const info = jest.fn();
		const logger = { ...noopLogger, info };
		const { handler } = createHandler({ logger });

		await handler(
			createSqsEvent({ url: "https://example.com/article", userId: "user-1", title: "Captured Title" }),
			stubContext,
			() => {},
		);

		expect(info).toHaveBeenCalledWith(
			"[SaveLinkRawHtmlCommand] saved tier-0 source",
			expect.objectContaining({ url: "https://example.com/article", capturedTitle: "Captured Title" }),
		);
	});

	describe("canonical contest", () => {
		it("promotes tier-0 to canonical and publishes LinkSavedEvent when no canonical exists", async () => {
			const { handler, readCanonicalContent, publishLinkSaved, selectMostCompleteContent } = createHandler();

			await handler(createSqsEvent({ url: "https://example.com/article", userId: "user-1" }), stubContext, () => {});

			expect(await readCanonicalContent({ url: "https://example.com/article" })).toEqual({
				html: "<p>Article content</p>",
				metadata: { title: "Test", wordCount: 10 },
			});
			expect(publishLinkSaved).toHaveBeenCalledWith({ url: "https://example.com/article", userId: "user-1" });
			expect(selectMostCompleteContent).not.toHaveBeenCalled();
		});

		it("promotes and publishes when a canonical exists and tier-0 wins the selector contest", async () => {
			const { handler, readCanonicalContent, seedCanonical, publishLinkSaved, selectMostCompleteContent } =
				createHandler({ selectMostCompleteContent: jest.fn(tierZeroWinsSelector) });
			seedCanonical({
				url: "https://example.com/article",
				html: "<p>old canonical body</p>",
				metadata: { title: "Old", wordCount: 5 },
			});

			await handler(createSqsEvent({ url: "https://example.com/article", userId: "user-1" }), stubContext, () => {});

			expect(selectMostCompleteContent).toHaveBeenCalledTimes(1);
			expect(await readCanonicalContent({ url: "https://example.com/article" })).toEqual({
				html: "<p>Article content</p>",
				metadata: { title: "Test", wordCount: 10 },
			});
			expect(publishLinkSaved).toHaveBeenCalledTimes(1);
		});

		it("leaves canonical untouched and does not publish when canonical wins the selector", async () => {
			const { handler, readCanonicalContent, seedCanonical, publishLinkSaved, selectMostCompleteContent } =
				createHandler({ selectMostCompleteContent: jest.fn(canonicalWinsSelector) });
			seedCanonical({
				url: "https://example.com/article",
				html: "<p>winning canonical body</p>",
				metadata: { title: "Existing", wordCount: 50 },
			});

			await handler(createSqsEvent({ url: "https://example.com/article", userId: "user-1" }), stubContext, () => {});

			expect(selectMostCompleteContent).toHaveBeenCalledTimes(1);
			expect(await readCanonicalContent({ url: "https://example.com/article" })).toEqual({
				html: "<p>winning canonical body</p>",
				metadata: { title: "Existing", wordCount: 50 },
			});
			expect(publishLinkSaved).not.toHaveBeenCalled();
		});

		it("leaves canonical untouched and does not publish when the selector returns tie", async () => {
			const tieSelector: SelectMostCompleteContent = async () => ({ winner: "tie", reason: "comparable" });
			const { handler, readCanonicalContent, seedCanonical, publishLinkSaved } = createHandler({
				selectMostCompleteContent: jest.fn(tieSelector),
			});
			seedCanonical({
				url: "https://example.com/article",
				html: "<p>existing</p>",
				metadata: { title: "Existing", wordCount: 30 },
			});

			await handler(createSqsEvent({ url: "https://example.com/article", userId: "user-1" }), stubContext, () => {});

			expect(await readCanonicalContent({ url: "https://example.com/article" })).toEqual({
				html: "<p>existing</p>",
				metadata: { title: "Existing", wordCount: 30 },
			});
			expect(publishLinkSaved).not.toHaveBeenCalled();
		});
	});

	describe("crawl status reset", () => {
		it("marks the crawl row ready after promoting tier-0 to a fresh canonical so a stale failed row no longer pins the reader to the failure card", async () => {
			const { handler, markCrawlReady } = createHandler();

			await handler(createSqsEvent({ url: "https://example.com/article", userId: "user-1" }), stubContext, () => {});

			expect(markCrawlReady).toHaveBeenCalledWith({ url: "https://example.com/article" });
		});

		it("marks the crawl row ready after tier-0 wins the selector contest over an existing canonical", async () => {
			const { handler, markCrawlReady, seedCanonical } = createHandler({
				selectMostCompleteContent: jest.fn(tierZeroWinsSelector),
			});
			seedCanonical({
				url: "https://example.com/article",
				html: "<p>old canonical body</p>",
				metadata: { title: "Old", wordCount: 5 },
			});

			await handler(createSqsEvent({ url: "https://example.com/article", userId: "user-1" }), stubContext, () => {});

			expect(markCrawlReady).toHaveBeenCalledWith({ url: "https://example.com/article" });
		});

		it("marks the crawl row ready when canonical wins the selector and is left in place — the row may be stuck on failed from a prior tier-1 attempt even though canonical content is good", async () => {
			const { handler, markCrawlReady, seedCanonical } = createHandler({
				selectMostCompleteContent: jest.fn(canonicalWinsSelector),
			});
			seedCanonical({
				url: "https://example.com/article",
				html: "<p>winning canonical body</p>",
				metadata: { title: "Existing", wordCount: 50 },
			});

			await handler(createSqsEvent({ url: "https://example.com/article", userId: "user-1" }), stubContext, () => {});

			expect(markCrawlReady).toHaveBeenCalledWith({ url: "https://example.com/article" });
		});

		it("marks the crawl row ready when the selector returns tie and canonical is left in place", async () => {
			const tieSelector: SelectMostCompleteContent = async () => ({ winner: "tie", reason: "comparable" });
			const { handler, markCrawlReady, seedCanonical } = createHandler({
				selectMostCompleteContent: jest.fn(tieSelector),
			});
			seedCanonical({
				url: "https://example.com/article",
				html: "<p>existing</p>",
				metadata: { title: "Existing", wordCount: 30 },
			});

			await handler(createSqsEvent({ url: "https://example.com/article", userId: "user-1" }), stubContext, () => {});

			expect(markCrawlReady).toHaveBeenCalledWith({ url: "https://example.com/article" });
		});

		// If publishLinkSaved fails and SQS retries, the row is already consistent
		// (good content + ready). The inverse order would publish a regen request
		// against a row still flagged failed, leaving the reader stuck.
		it("marks the crawl ready before publishing LinkSavedEvent so a publish failure still leaves the row consistent", async () => {
			const { handler, markCrawlReady, publishLinkSaved } = createHandler();

			await handler(createSqsEvent({ url: "https://example.com/article", userId: "user-1" }), stubContext, () => {});

			expect(markCrawlReady).toHaveBeenCalledTimes(1);
			expect(publishLinkSaved).toHaveBeenCalledTimes(1);
			expect(markCrawlReady.mock.invocationCallOrder[0])
				.toBeLessThan(publishLinkSaved.mock.invocationCallOrder[0]);
		});
	});
});
