import { noopLogger, HutchLogger } from "@packages/hutch-logger";
import type { SQSEvent, SQSRecord, SQSRecordAttributes } from "aws-lambda";
import { initInMemoryArticleStore } from "../providers/article-store/in-memory-article-store";
import type { Minutes } from "../domain/article/article.types";
import type { UserId } from "../domain/user/user.types";
import type { UploadUserDataExport } from "../providers/user-data-export/user-data-export.types";
import { initExportUserDataHandler } from "./export-user-data-handler";

const stubAttributes: SQSRecordAttributes = {
	ApproximateReceiveCount: "1",
	SentTimestamp: "1620000000000",
	SenderId: "TESTID",
	ApproximateFirstReceiveTimestamp: "1620000000001",
};

function createSqsEvent(detail: {
	userId: string;
	email: string;
	requestedAt: string;
}): SQSEvent {
	const record: SQSRecord = {
		messageId: "msg-1",
		receiptHandle: "receipt-1",
		body: JSON.stringify({ detail }),
		attributes: stubAttributes,
		messageAttributes: {},
		md5OfBody: "",
		eventSource: "aws:sqs",
		eventSourceARN:
			"arn:aws:sqs:ap-southeast-2:123456789:export-user-data",
		awsRegion: "ap-southeast-2",
	};
	return { Records: [record] };
}

function fixedNow(): Date {
	return new Date("2026-04-30T12:00:00.000Z");
}

interface HandlerHarness {
	uploadCalls: Array<{ userId: string; bodyLength: number; parsedBody: unknown }>;
	emailCalls: Array<{ to: string; subject: string; html: string }>;
	publishedEvents: Array<{ source: string; detailType: string; detail: unknown }>;
	handler: ReturnType<typeof initExportUserDataHandler>;
	store: ReturnType<typeof initInMemoryArticleStore>;
}

function createHarness(): HandlerHarness {
	const store = initInMemoryArticleStore();
	const uploadCalls: HandlerHarness["uploadCalls"] = [];
	const uploadUserDataExport: UploadUserDataExport = async ({ userId, body }) => {
		uploadCalls.push({ userId, bodyLength: body.length, parsedBody: JSON.parse(body) });
		return {
			s3Key: `exports/${userId}/2026-04-30T12-00-00-000Z.json`,
			downloadUrl: `https://example.com/signed/${userId}`,
		};
	};
	const emailCalls: HandlerHarness["emailCalls"] = [];
	const publishedEvents: HandlerHarness["publishedEvents"] = [];

	const handler = initExportUserDataHandler({
		findArticlesByUser: store.findArticlesByUser,
		uploadUserDataExport,
		sendEmail: async (msg) => {
			emailCalls.push({ to: msg.to, subject: msg.subject, html: msg.html });
		},
		publishEvent: async (params: { source: string; detailType: string; detail: string }) => {
			publishedEvents.push({
				source: params.source,
				detailType: params.detailType,
				detail: JSON.parse(params.detail),
			});
		},
		logger: HutchLogger.from(noopLogger),
		now: fixedNow,
	});

	return { uploadCalls, emailCalls, publishedEvents, handler, store };
}

async function invokeHandler(
	harness: HandlerHarness,
	detail: { userId: string; email: string; requestedAt: string },
): Promise<void> {
	const result = harness.handler(createSqsEvent(detail), {} as never, () => {});
	if (result instanceof Promise) await result;
}

describe("initExportUserDataHandler", () => {
	it("uploads an export, emails the user a download link, and publishes UserDataExportedEvent", async () => {
		const harness = createHarness();
		const userId = "user-1" as UserId;
		await harness.store.saveArticle({
			userId,
			url: "https://example.com/article-1",
			metadata: {
				title: "Article 1",
				siteName: "example.com",
				excerpt: "An excerpt",
				wordCount: 100,
			},
			estimatedReadTime: 1 as Minutes,
		});

		await invokeHandler(harness, {
			userId,
			email: "user@example.com",
			requestedAt: "2026-04-30T11:59:00.000Z",
		});

		expect(harness.uploadCalls).toHaveLength(1);
		const upload = harness.uploadCalls[0];
		expect(upload.userId).toBe(userId);
		const body = upload.parsedBody as {
			articleCount: number;
			articles: Array<{ url: string; title: string }>;
		};
		expect(body.articleCount).toBe(1);
		expect(body.articles[0].url).toBe("https://example.com/article-1");
		expect(body.articles[0].title).toBe("Article 1");

		expect(harness.emailCalls).toHaveLength(1);
		const email = harness.emailCalls[0];
		expect(email.to).toBe("user@example.com");
		expect(email.subject).toBe("Your Readplace export is ready");
		expect(email.html).toContain(`https://example.com/signed/${userId}`);
		expect(email.html).toContain("7 days");

		expect(harness.publishedEvents).toHaveLength(1);
		expect(harness.publishedEvents[0].detailType).toBe("UserDataExported");
		expect(harness.publishedEvents[0].detail).toEqual({
			userId,
			articleCount: 1,
			s3Key: `exports/${userId}/2026-04-30T12-00-00-000Z.json`,
			exportedAt: "2026-04-30T12:00:00.000Z",
		});
	});

	it("paginates through every page when the user has more articles than one page", async () => {
		const harness = createHarness();
		const userId = "user-many" as UserId;
		// PAGE_SIZE in the handler is 500; cross the boundary to force two pages.
		const TOTAL = 600;
		for (let i = 0; i < TOTAL; i++) {
			await harness.store.saveArticle({
				userId,
				url: `https://example.com/article-${i}`,
				metadata: {
					title: `Article ${i}`,
					siteName: "example.com",
					excerpt: "x",
					wordCount: 100,
				},
				estimatedReadTime: 1 as Minutes,
			});
		}

		await invokeHandler(harness, {
			userId,
			email: "user@example.com",
			requestedAt: "2026-04-30T11:59:00.000Z",
		});

		const body = harness.uploadCalls[0].parsedBody as { articleCount: number };
		expect(body.articleCount).toBe(TOTAL);
		expect(harness.publishedEvents[0].detail).toMatchObject({ articleCount: TOTAL });
	});

	it("emits an empty export when the user has no articles", async () => {
		const harness = createHarness();
		const userId = "user-empty" as UserId;

		await invokeHandler(harness, {
			userId,
			email: "user@example.com",
			requestedAt: "2026-04-30T11:59:00.000Z",
		});

		const body = harness.uploadCalls[0].parsedBody as { articleCount: number; articles: unknown[] };
		expect(body.articleCount).toBe(0);
		expect(body.articles).toEqual([]);
		expect(harness.emailCalls[0].html).toContain("0 articles");
	});
});
