import posthtml from "posthtml";
import urls from "@11ty/posthtml-urls";
import { noopLogger } from "@packages/hutch-logger";
import { initSaveLinkRawHtmlCommandHandler } from "./save-link-raw-html-command-handler";
import { initInMemorySourceContent } from "./in-memory-source-content";
import { initInMemoryCanonicalContent } from "./in-memory-canonical-content";
import { initSelectMostCompleteContent, type CreateSelectorChatCompletion } from "./select-content";
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

function fixedDeepseek(decision: "A" | "B" | "tie", reason = "fixed"): CreateSelectorChatCompletion {
	return jest.fn().mockResolvedValue({
		choices: [{ message: { content: JSON.stringify({ winner: decision, reason }) } }],
	});
}

function buildSystem(opts: {
	parseHtml: ParseHtml;
	deepseek: CreateSelectorChatCompletion;
	rawHtml?: string;
}) {
	const sourceContent = initInMemorySourceContent();
	const canonicalContent = initInMemoryCanonicalContent({
		readSourceContent: sourceContent.readSourceContent,
	});
	const { selectMostCompleteContent } = initSelectMostCompleteContent({
		createChatCompletion: opts.deepseek,
		logger: noopLogger,
	});
	const publishLinkSaved = jest.fn().mockResolvedValue(undefined);
	const markCrawlReady = jest.fn().mockResolvedValue(undefined);
	const readPendingHtml: ReadPendingHtml = jest.fn().mockResolvedValue(
		opts.rawHtml ?? "<html><body><p>captured</p></body></html>",
	);
	const handler = initSaveLinkRawHtmlCommandHandler({
		readPendingHtml,
		parseHtml: opts.parseHtml,
		downloadMedia: noopDownloadMedia,
		processContent,
		putSourceContent: sourceContent.putSourceContent,
		readCanonicalContent: canonicalContent.readCanonicalContent,
		promoteSourceToCanonical: canonicalContent.promoteSourceToCanonical,
		selectMostCompleteContent,
		publishLinkSaved,
		markCrawlReady,
		markCrawlFailed: jest.fn().mockResolvedValue(undefined),
		logParseError: jest.fn(),
		logger: noopLogger,
		logParseError: jest.fn(),
		logCrawlOutcome: jest.fn(),
		readTierSnapshot: jest.fn().mockResolvedValue({ tier0Status: "success", tier1Status: "not_attempted", pickedTier: "tier-0" }),
	});
	return {
		handler,
		readSourceContent: sourceContent.readSourceContent,
		readCanonicalContent: canonicalContent.readCanonicalContent,
		seedCanonical: canonicalContent.seedCanonical,
		publishLinkSaved,
		markCrawlReady,
		deepseek: opts.deepseek,
	};
}

describe("save-link-raw-html-command-handler [integration]", () => {
	it("first save promotes tier-0 to canonical without consulting Deepseek and publishes LinkSavedEvent", async () => {
		const parseHtml: ParseHtml = () => ({
			ok: true,
			article: {
				title: "Fresh Article",
				siteName: "example.com",
				excerpt: "intro",
				wordCount: 800,
				content: "<p>full article body for the fresh save</p>",
			},
		});
		const deepseek = fixedDeepseek("A");
		const sys = buildSystem({ parseHtml, deepseek });

		await sys.handler(createSqsEvent({ url: "https://example.com/a", userId: "user-1" }), stubContext, () => {});

		expect(sys.readSourceContent({ url: "https://example.com/a", tier: "tier-0" }))
			.toBe("<p>full article body for the fresh save</p>");
		expect(await sys.readCanonicalContent({ url: "https://example.com/a" })).toEqual({
			html: "<p>full article body for the fresh save</p>",
			metadata: { title: "Fresh Article", wordCount: 800 },
		});
		expect(deepseek).not.toHaveBeenCalled();
		expect(sys.publishLinkSaved).toHaveBeenCalledWith({ url: "https://example.com/a", userId: "user-1" });
	});

	it("a weaker second save (selector picks canonical) leaves canonical untouched and does not publish", async () => {
		const parseHtml: ParseHtml = () => ({
			ok: true,
			article: {
				title: "Weak Stub",
				siteName: "example.com",
				excerpt: "stub",
				wordCount: 30,
				content: "<p>verify you are human</p>",
			},
		});
		const deepseek = fixedDeepseek("B", "tier-0 is anti-bot stub");
		const sys = buildSystem({ parseHtml, deepseek });
		sys.seedCanonical({
			url: "https://example.com/a",
			html: "<p>strong existing canonical body</p>",
			metadata: { title: "Existing", wordCount: 1200 },
		});

		await sys.handler(createSqsEvent({ url: "https://example.com/a", userId: "user-1" }), stubContext, () => {});

		expect(sys.readSourceContent({ url: "https://example.com/a", tier: "tier-0" }))
			.toBe("<p>verify you are human</p>");
		expect(await sys.readCanonicalContent({ url: "https://example.com/a" })).toEqual({
			html: "<p>strong existing canonical body</p>",
			metadata: { title: "Existing", wordCount: 1200 },
		});
		expect(deepseek).toHaveBeenCalledTimes(1);
		expect(sys.publishLinkSaved).not.toHaveBeenCalled();
	});

	it("a stronger second save (selector picks tier-0) promotes over canonical and publishes", async () => {
		const parseHtml: ParseHtml = () => ({
			ok: true,
			article: {
				title: "Strong Tier 0",
				siteName: "example.com",
				excerpt: "intro",
				wordCount: 1500,
				content: "<p>much richer tier-0 article body extracted from the user's authenticated tab</p>",
			},
		});
		const deepseek = fixedDeepseek("A", "tier-0 has full prose vs. paywalled stub");
		const sys = buildSystem({ parseHtml, deepseek });
		sys.seedCanonical({
			url: "https://example.com/a",
			html: "<p>This is the publicly available preview...</p>",
			metadata: { title: "Paywalled", wordCount: 80 },
		});

		await sys.handler(createSqsEvent({ url: "https://example.com/a", userId: "user-1" }), stubContext, () => {});

		expect(await sys.readCanonicalContent({ url: "https://example.com/a" })).toEqual({
			html: "<p>much richer tier-0 article body extracted from the user's authenticated tab</p>",
			metadata: { title: "Strong Tier 0", wordCount: 1500 },
		});
		expect(deepseek).toHaveBeenCalledTimes(1);
		expect(sys.publishLinkSaved).toHaveBeenCalledWith({ url: "https://example.com/a", userId: "user-1" });
	});

	it("selector tie leaves the existing canonical in place", async () => {
		const parseHtml: ParseHtml = () => ({
			ok: true,
			article: {
				title: "Tier 0",
				siteName: "example.com",
				excerpt: "intro",
				wordCount: 500,
				content: "<p>tier-0 body</p>",
			},
		});
		const deepseek = fixedDeepseek("tie", "comparable");
		const sys = buildSystem({ parseHtml, deepseek });
		sys.seedCanonical({
			url: "https://example.com/a",
			html: "<p>existing canonical body</p>",
			metadata: { title: "Existing", wordCount: 500 },
		});

		await sys.handler(createSqsEvent({ url: "https://example.com/a", userId: "user-1" }), stubContext, () => {});

		expect(await sys.readCanonicalContent({ url: "https://example.com/a" })).toEqual({
			html: "<p>existing canonical body</p>",
			metadata: { title: "Existing", wordCount: 500 },
		});
		expect(sys.publishLinkSaved).not.toHaveBeenCalled();
	});

	// Reproduces the production regression where a row's crawlStatus was pinned
	// to "failed" by an earlier tier-1 attempt; a subsequent tier-0 save left the
	// reader stuck on the failed card even after a fresh canonical was promoted.
	it("marks the crawl row ready after a successful canonical operation across every selector branch", async () => {
		const parseHtml: ParseHtml = () => ({
			ok: true,
			article: {
				title: "Recovered Article",
				siteName: "example.com",
				excerpt: "intro",
				wordCount: 700,
				content: "<p>tier-0 recovered body</p>",
			},
		});

		const freshSave = buildSystem({ parseHtml, deepseek: fixedDeepseek("A") });
		await freshSave.handler(createSqsEvent({ url: "https://example.com/a", userId: "user-1" }), stubContext, () => {});
		expect(freshSave.markCrawlReady).toHaveBeenCalledWith({ url: "https://example.com/a" });

		const tierZeroWins = buildSystem({ parseHtml, deepseek: fixedDeepseek("A") });
		tierZeroWins.seedCanonical({
			url: "https://example.com/b",
			html: "<p>weak existing canonical</p>",
			metadata: { title: "Weak", wordCount: 30 },
		});
		await tierZeroWins.handler(createSqsEvent({ url: "https://example.com/b", userId: "user-1" }), stubContext, () => {});
		expect(tierZeroWins.markCrawlReady).toHaveBeenCalledWith({ url: "https://example.com/b" });

		const canonicalWins = buildSystem({ parseHtml, deepseek: fixedDeepseek("B") });
		canonicalWins.seedCanonical({
			url: "https://example.com/c",
			html: "<p>strong existing canonical body</p>",
			metadata: { title: "Existing", wordCount: 1200 },
		});
		await canonicalWins.handler(createSqsEvent({ url: "https://example.com/c", userId: "user-1" }), stubContext, () => {});
		expect(canonicalWins.markCrawlReady).toHaveBeenCalledWith({ url: "https://example.com/c" });

		const tie = buildSystem({ parseHtml, deepseek: fixedDeepseek("tie") });
		tie.seedCanonical({
			url: "https://example.com/d",
			html: "<p>existing canonical</p>",
			metadata: { title: "Existing", wordCount: 700 },
		});
		await tie.handler(createSqsEvent({ url: "https://example.com/d", userId: "user-1" }), stubContext, () => {});
		expect(tie.markCrawlReady).toHaveBeenCalledWith({ url: "https://example.com/d" });
	});
});
