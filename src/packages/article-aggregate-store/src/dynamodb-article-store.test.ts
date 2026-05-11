import type { Article, Minutes } from "@packages/domain/article";
import type { DynamoDBDocumentClient } from "@packages/hutch-storage-client";
import { initDynamoDbArticleStore } from "./dynamodb-article-store";

type SendFn = DynamoDBDocumentClient["send"];

function createFakeClient(
	impl: (input: unknown) => unknown,
): Partial<DynamoDBDocumentClient> {
	return {
		send: (async (input: unknown) => impl(input)) as unknown as SendFn,
	};
}

const TABLE = "test-articles";
const URL = "https://example.com/article";

function buildArticle(overrides: Partial<Article> = {}): Article {
	return {
		url: URL,
		crawl: { status: "ready" },
		summary: {
			status: "ready",
			summary: "Generated.",
			excerpt: "Excerpt.",
			inputTokens: 10,
			outputTokens: 5,
		},
		metadata: {
			title: "T",
			siteName: "example.com",
			excerpt: "E",
			wordCount: 100,
			imageUrl: "https://cdn.example.com/i.png",
		},
		estimatedReadTime: 2 as Minutes,
		contentFetchedAt: "2026-05-11T00:00:00Z",
		etag: '"v1"',
		lastModified: "Mon, 11 May 2026 00:00:00 GMT",
		...overrides,
	};
}

interface UpdateInput {
	input: {
		Key?: { url: string };
		UpdateExpression?: string;
		ExpressionAttributeValues?: Record<string, unknown>;
	};
}

describe("initDynamoDbArticleStore.load", () => {
	it("returns undefined when no row exists for the URL", async () => {
		const client = createFakeClient(() => ({}));
		const store = initDynamoDbArticleStore({
			client: client as DynamoDBDocumentClient,
			tableName: TABLE,
		});
		const loaded = await store.load(URL);
		expect(loaded).toBeUndefined();
	});

	it("projects a fully-populated ready row into an Article aggregate", async () => {
		const client = createFakeClient(() => ({
			Item: {
				url: URL,
				crawlStatus: "ready",
				summaryStatus: "ready",
				summary: "Generated.",
				summaryExcerpt: "Excerpt.",
				summaryInputTokens: 10,
				summaryOutputTokens: 5,
				title: "T",
				siteName: "example.com",
				excerpt: "E",
				wordCount: 100,
				estimatedReadTime: 2,
				imageUrl: "https://cdn.example.com/i.png",
				contentFetchedAt: "2026-05-11T00:00:00Z",
				etag: '"v1"',
				lastModified: "Mon, 11 May 2026 00:00:00 GMT",
			},
		}));
		const store = initDynamoDbArticleStore({
			client: client as DynamoDBDocumentClient,
			tableName: TABLE,
		});

		const loaded = await store.load(URL);
		expect(loaded).toMatchObject({
			url: URL,
			crawl: { status: "ready" },
			summary: {
				status: "ready",
				summary: "Generated.",
				excerpt: "Excerpt.",
				inputTokens: 10,
				outputTokens: 5,
			},
		});
		expect(loaded?.metadata.imageUrl).toBe("https://cdn.example.com/i.png");
		expect(loaded?.etag).toBe('"v1"');
	});

	it("projects a pre-aggregate row (no summary) with pending sub-states", async () => {
		const client = createFakeClient(() => ({
			Item: { url: URL },
		}));
		const store = initDynamoDbArticleStore({
			client: client as DynamoDBDocumentClient,
			tableName: TABLE,
		});

		const loaded = await store.load(URL);
		expect(loaded?.crawl).toEqual({ status: "pending" });
		expect(loaded?.summary).toEqual({ status: "pending" });
		expect(loaded?.metadata.title).toBe("");
	});

	it("projects a failed crawl with its reason and timestamp", async () => {
		const client = createFakeClient(() => ({
			Item: {
				url: URL,
				crawlStatus: "failed",
				crawlFailureReason: "ETIMEDOUT",
				crawlFailedAt: "2026-05-10T12:00:00Z",
				summaryStatus: "failed",
				summaryFailureReason: "AI unavailable",
			},
		}));
		const store = initDynamoDbArticleStore({
			client: client as DynamoDBDocumentClient,
			tableName: TABLE,
		});
		const loaded = await store.load(URL);
		expect(loaded?.crawl).toEqual({
			status: "failed",
			reason: "ETIMEDOUT",
			failedAt: "2026-05-10T12:00:00Z",
		});
		expect(loaded?.summary).toEqual({
			status: "failed",
			reason: "AI unavailable",
		});
	});

	it("projects unsupported crawl + skipped summary", async () => {
		const client = createFakeClient(() => ({
			Item: {
				url: URL,
				crawlStatus: "unsupported",
				crawlUnsupportedReason: "application/pdf",
				crawlFailedAt: "2026-05-10T12:00:00Z",
				summaryStatus: "skipped",
				summarySkippedReason: "crawl-unsupported",
			},
		}));
		const store = initDynamoDbArticleStore({
			client: client as DynamoDBDocumentClient,
			tableName: TABLE,
		});
		const loaded = await store.load(URL);
		expect(loaded?.crawl).toEqual({
			status: "unsupported",
			reason: "application/pdf",
			failedAt: "2026-05-10T12:00:00Z",
		});
		expect(loaded?.summary).toEqual({
			status: "skipped",
			reason: "crawl-unsupported",
		});
	});

	it("projects pending sub-states with their stage when set", async () => {
		const client = createFakeClient(() => ({
			Item: {
				url: URL,
				crawlStatus: "pending",
				crawlStage: "crawl-parsed",
				summaryStatus: "pending",
				summaryStage: "summary-generating",
			},
		}));
		const store = initDynamoDbArticleStore({
			client: client as DynamoDBDocumentClient,
			tableName: TABLE,
		});
		const loaded = await store.load(URL);
		expect(loaded?.crawl).toEqual({
			status: "pending",
			stage: "crawl-parsed",
		});
		expect(loaded?.summary).toEqual({
			status: "pending",
			stage: "summary-generating",
		});
	});

	it("projects skipped summary without a reason", async () => {
		const client = createFakeClient(() => ({
			Item: { url: URL, summaryStatus: "skipped" },
		}));
		const store = initDynamoDbArticleStore({
			client: client as DynamoDBDocumentClient,
			tableName: TABLE,
		});
		const loaded = await store.load(URL);
		expect(loaded?.summary).toEqual({ status: "skipped" });
	});

	it("projects a ready summary without excerpt or token counts (legacy backfill)", async () => {
		const client = createFakeClient(() => ({
			Item: {
				url: URL,
				summaryStatus: "ready",
				summary: "Old summary text.",
			},
		}));
		const store = initDynamoDbArticleStore({
			client: client as DynamoDBDocumentClient,
			tableName: TABLE,
		});
		const loaded = await store.load(URL);
		expect(loaded?.summary).toEqual({
			status: "ready",
			summary: "Old summary text.",
			inputTokens: 0,
			outputTokens: 0,
		});
		expect(loaded?.summary).not.toHaveProperty("excerpt");
	});

	it("projects a ready summary with missing summary text as empty string (legacy corruption safety net)", async () => {
		const client = createFakeClient(() => ({
			Item: {
				url: URL,
				summaryStatus: "ready",
			},
		}));
		const store = initDynamoDbArticleStore({
			client: client as DynamoDBDocumentClient,
			tableName: TABLE,
		});
		const loaded = await store.load(URL);
		expect(loaded?.summary).toEqual({
			status: "ready",
			summary: "",
			inputTokens: 0,
			outputTokens: 0,
		});
	});

	it("projects failed crawl with legacy missing reason/failedAt as 'unknown'/empty", async () => {
		const client = createFakeClient(() => ({
			Item: { url: URL, crawlStatus: "failed" },
		}));
		const store = initDynamoDbArticleStore({
			client: client as DynamoDBDocumentClient,
			tableName: TABLE,
		});
		const loaded = await store.load(URL);
		expect(loaded?.crawl).toEqual({
			status: "failed",
			reason: "unknown",
			failedAt: "",
		});
	});

	it("projects unsupported crawl with legacy missing reason as 'unknown'", async () => {
		const client = createFakeClient(() => ({
			Item: { url: URL, crawlStatus: "unsupported" },
		}));
		const store = initDynamoDbArticleStore({
			client: client as DynamoDBDocumentClient,
			tableName: TABLE,
		});
		const loaded = await store.load(URL);
		expect(loaded?.crawl).toEqual({
			status: "unsupported",
			reason: "unknown",
			failedAt: "",
		});
	});

	it("projects failed summary with legacy missing reason as 'unknown'", async () => {
		const client = createFakeClient(() => ({
			Item: { url: URL, summaryStatus: "failed" },
		}));
		const store = initDynamoDbArticleStore({
			client: client as DynamoDBDocumentClient,
			tableName: TABLE,
		});
		const loaded = await store.load(URL);
		expect(loaded?.summary).toEqual({ status: "failed", reason: "unknown" });
	});
});

describe("initDynamoDbArticleStore.save", () => {
	it("writes an unconditional update with the article fields", async () => {
		let received: unknown;
		const client = createFakeClient((input) => {
			received = input;
			return {};
		});
		const store = initDynamoDbArticleStore({
			client: client as DynamoDBDocumentClient,
			tableName: TABLE,
		});

		await store.save(buildArticle());

		const cmd = received as UpdateInput;
		expect(cmd.input.UpdateExpression).toContain("crawlStatus = :crawlStatus");
		expect(cmd.input.UpdateExpression).toContain("summaryStatus = :summaryStatus");
		expect(cmd.input.UpdateExpression).toContain("title = :title");
	});

	it("sets metadata + summary ready payload and REMOVEs failure-side attributes", async () => {
		let received: unknown;
		const client = createFakeClient((input) => {
			received = input;
			return {};
		});
		const store = initDynamoDbArticleStore({
			client: client as DynamoDBDocumentClient,
			tableName: TABLE,
		});

		await store.save(
			buildArticle({
				summary: {
					status: "ready",
					summary: "Generated.",
					excerpt: "Excerpt.",
					inputTokens: 10,
					outputTokens: 5,
				},
			}),
		);

		const cmd = received as UpdateInput;
		expect(cmd.input.UpdateExpression).toContain("summaryStatus = :summaryStatus");
		expect(cmd.input.UpdateExpression).toContain("summary = :summary");
		expect(cmd.input.UpdateExpression).toContain(
			"summaryInputTokens = :summaryInputTokens",
		);
		expect(cmd.input.UpdateExpression).toContain(
			"summaryOutputTokens = :summaryOutputTokens",
		);
		expect(cmd.input.UpdateExpression).toContain(
			"summaryExcerpt = :summaryExcerpt",
		);
		expect(cmd.input.UpdateExpression).toContain("REMOVE");
		expect(cmd.input.UpdateExpression).toContain("summaryFailureReason");
		expect(cmd.input.UpdateExpression).toContain("summarySkippedReason");
	});

	it("for summary=pending, REMOVEs every payload attribute to prevent ready/missing-text drift", async () => {
		let received: unknown;
		const client = createFakeClient((input) => {
			received = input;
			return {};
		});
		const store = initDynamoDbArticleStore({
			client: client as DynamoDBDocumentClient,
			tableName: TABLE,
		});

		await store.save(
			buildArticle({
				summary: { status: "pending" },
			}),
		);

		const cmd = received as UpdateInput;
		expect(cmd.input.UpdateExpression).toContain("summaryStatus = :summaryStatus");
		expect(cmd.input.UpdateExpression).toContain("REMOVE");
		expect(cmd.input.UpdateExpression).toContain("summary");
		expect(cmd.input.UpdateExpression).toContain("summaryExcerpt");
		expect(cmd.input.UpdateExpression).toContain("summaryInputTokens");
		expect(cmd.input.UpdateExpression).toContain("summaryOutputTokens");
		expect(cmd.input.UpdateExpression).toContain("summaryFailureReason");
		expect(cmd.input.UpdateExpression).toContain("summarySkippedReason");
		expect(cmd.input.ExpressionAttributeValues?.[":summaryStatus"]).toBe(
			"pending",
		);
	});

	it("for crawl=failed, SETs reason + failedAt and REMOVEs crawlUnsupportedReason", async () => {
		let received: unknown;
		const client = createFakeClient((input) => {
			received = input;
			return {};
		});
		const store = initDynamoDbArticleStore({
			client: client as DynamoDBDocumentClient,
			tableName: TABLE,
		});

		await store.save(
			buildArticle({
				crawl: {
					status: "failed",
					reason: "ETIMEDOUT",
					failedAt: "2026-05-10T12:00:00Z",
				},
			}),
		);

		const cmd = received as UpdateInput;
		expect(cmd.input.UpdateExpression).toContain(
			"crawlFailureReason = :crawlFailureReason",
		);
		expect(cmd.input.UpdateExpression).toContain("crawlFailedAt = :crawlFailedAt");
		expect(cmd.input.UpdateExpression).toContain("crawlUnsupportedReason");
		expect(cmd.input.ExpressionAttributeValues?.[":crawlFailureReason"]).toBe(
			"ETIMEDOUT",
		);
	});

	it("for crawl=unsupported, SETs reason + failedAt and REMOVEs crawlFailureReason", async () => {
		let received: unknown;
		const client = createFakeClient((input) => {
			received = input;
			return {};
		});
		const store = initDynamoDbArticleStore({
			client: client as DynamoDBDocumentClient,
			tableName: TABLE,
		});

		await store.save(
			buildArticle({
				crawl: {
					status: "unsupported",
					reason: "application/pdf",
					failedAt: "2026-05-10T12:00:00Z",
				},
			}),
		);

		const cmd = received as UpdateInput;
		expect(cmd.input.UpdateExpression).toContain(
			"crawlUnsupportedReason = :crawlUnsupportedReason",
		);
		expect(cmd.input.UpdateExpression).toContain("crawlFailedAt = :crawlFailedAt");
		expect(cmd.input.UpdateExpression).toContain("crawlFailureReason");
		expect(cmd.input.ExpressionAttributeValues?.[":crawlUnsupportedReason"]).toBe(
			"application/pdf",
		);
	});

	it("for crawl=pending and crawl=ready, REMOVEs every failure-side attribute", async () => {
		let received: unknown;
		const client = createFakeClient((input) => {
			received = input;
			return {};
		});
		const store = initDynamoDbArticleStore({
			client: client as DynamoDBDocumentClient,
			tableName: TABLE,
		});

		await store.save(buildArticle({ crawl: { status: "pending" } }));

		const cmd = received as UpdateInput;
		expect(cmd.input.UpdateExpression).toContain("REMOVE");
		expect(cmd.input.UpdateExpression).toContain("crawlFailureReason");
		expect(cmd.input.UpdateExpression).toContain("crawlUnsupportedReason");
		expect(cmd.input.UpdateExpression).toContain("crawlFailedAt");
	});

	it("for summary=failed, REMOVEs ready-side payload AND summarySkippedReason", async () => {
		let received: unknown;
		const client = createFakeClient((input) => {
			received = input;
			return {};
		});
		const store = initDynamoDbArticleStore({
			client: client as DynamoDBDocumentClient,
			tableName: TABLE,
		});

		await store.save(
			buildArticle({
				summary: { status: "failed", reason: "AI throttled" },
			}),
		);

		const cmd = received as UpdateInput;
		expect(cmd.input.UpdateExpression).toContain(
			"summaryFailureReason = :summaryFailureReason",
		);
		expect(cmd.input.ExpressionAttributeValues?.[":summaryFailureReason"]).toBe(
			"AI throttled",
		);
		expect(cmd.input.UpdateExpression).toContain("REMOVE");
		expect(cmd.input.UpdateExpression).toContain("summary");
	});

	it("for summary=skipped with a reason, SETs the reason", async () => {
		let received: unknown;
		const client = createFakeClient((input) => {
			received = input;
			return {};
		});
		const store = initDynamoDbArticleStore({
			client: client as DynamoDBDocumentClient,
			tableName: TABLE,
		});

		await store.save(
			buildArticle({
				summary: { status: "skipped", reason: "content-too-short" },
			}),
		);

		const cmd = received as UpdateInput;
		expect(cmd.input.UpdateExpression).toContain(
			"summarySkippedReason = :summarySkippedReason",
		);
		expect(cmd.input.ExpressionAttributeValues?.[":summarySkippedReason"]).toBe(
			"content-too-short",
		);
	});

	it("for summary=skipped without a reason, REMOVEs the reason attribute", async () => {
		let received: unknown;
		const client = createFakeClient((input) => {
			received = input;
			return {};
		});
		const store = initDynamoDbArticleStore({
			client: client as DynamoDBDocumentClient,
			tableName: TABLE,
		});

		await store.save(buildArticle({ summary: { status: "skipped" } }));

		const cmd = received as UpdateInput;
		expect(cmd.input.UpdateExpression).toContain("REMOVE");
		expect(cmd.input.UpdateExpression).toContain("summarySkippedReason");
	});

	it("for summary=ready without excerpt, REMOVEs summaryExcerpt", async () => {
		let received: unknown;
		const client = createFakeClient((input) => {
			received = input;
			return {};
		});
		const store = initDynamoDbArticleStore({
			client: client as DynamoDBDocumentClient,
			tableName: TABLE,
		});

		await store.save(
			buildArticle({
				summary: {
					status: "ready",
					summary: "Generated.",
					inputTokens: 10,
					outputTokens: 5,
				},
			}),
		);

		const cmd = received as UpdateInput;
		expect(cmd.input.UpdateExpression).toContain("REMOVE");
		expect(cmd.input.UpdateExpression).toContain("summaryExcerpt");
	});

	it("when imageUrl is absent, REMOVEs the attribute", async () => {
		let received: unknown;
		const client = createFakeClient((input) => {
			received = input;
			return {};
		});
		const store = initDynamoDbArticleStore({
			client: client as DynamoDBDocumentClient,
			tableName: TABLE,
		});

		await store.save(
			buildArticle({
				metadata: {
					title: "T",
					siteName: "example.com",
					excerpt: "E",
					wordCount: 100,
				},
			}),
		);

		const cmd = received as UpdateInput;
		expect(cmd.input.UpdateExpression).toContain("REMOVE");
		expect(cmd.input.UpdateExpression).toContain("imageUrl");
	});

	it("when freshness fields are absent, REMOVEs them", async () => {
		let received: unknown;
		const client = createFakeClient((input) => {
			received = input;
			return {};
		});
		const store = initDynamoDbArticleStore({
			client: client as DynamoDBDocumentClient,
			tableName: TABLE,
		});

		await store.save(
			buildArticle({
				contentFetchedAt: undefined,
				etag: undefined,
				lastModified: undefined,
			}),
		);

		const cmd = received as UpdateInput;
		expect(cmd.input.UpdateExpression).toContain("contentFetchedAt");
		expect(cmd.input.UpdateExpression).toContain("etag");
		expect(cmd.input.UpdateExpression).toContain("lastModified");
	});

	it("rethrows errors from the DynamoDB client", async () => {
		const client = createFakeClient(() => {
			throw new Error("ProvisionedThroughputExceededException");
		});
		const store = initDynamoDbArticleStore({
			client: client as DynamoDBDocumentClient,
			tableName: TABLE,
		});

		await expect(
			store.save(buildArticle()),
		).rejects.toThrow("ProvisionedThroughputExceededException");
	});
});
