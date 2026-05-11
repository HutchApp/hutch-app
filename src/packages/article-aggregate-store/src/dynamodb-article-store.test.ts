import { noopLogger } from "@packages/hutch-logger";
import { AggregateConcurrencyError } from "@packages/domain/article";
import type { Article, Minutes } from "@packages/domain/article";
import {
	ConditionalCheckFailedException,
	type DynamoDBDocumentClient,
} from "@packages/hutch-storage-client";
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
		version: 3,
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
		ConditionExpression?: string;
		ExpressionAttributeValues?: Record<string, unknown>;
	};
}

describe("initDynamoDbArticleStore.load", () => {
	it("returns undefined when no row exists for the URL", async () => {
		const client = createFakeClient(() => ({}));
		const store = initDynamoDbArticleStore({
			client: client as DynamoDBDocumentClient,
			tableName: TABLE,
			logger: noopLogger,
		});
		const loaded = await store.load(URL);
		expect(loaded).toBeUndefined();
	});

	it("projects a fully-populated ready row into an Article aggregate", async () => {
		const client = createFakeClient(() => ({
			Item: {
				url: URL,
				version: 4,
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
			logger: noopLogger,
		});

		const loaded = await store.load(URL);
		expect(loaded).toMatchObject({
			url: URL,
			version: 4,
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

	it("projects a pre-aggregate row (no version, no summary) as version=0 with pending sub-states", async () => {
		// Pre-aggregate rows live in DDB today. Phase 1 reads them through the
		// aggregate adapter and the orchestrator can transition them; the
		// first successful save bumps version to 1. The schema absorbs the
		// missing attributes via dynamoField; the projection function fills
		// in safe defaults.
		const client = createFakeClient(() => ({
			Item: { url: URL },
		}));
		const store = initDynamoDbArticleStore({
			client: client as DynamoDBDocumentClient,
			tableName: TABLE,
			logger: noopLogger,
		});

		const loaded = await store.load(URL);
		expect(loaded?.version).toBe(0);
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
			logger: noopLogger,
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
			logger: noopLogger,
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
			logger: noopLogger,
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
			logger: noopLogger,
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
			logger: noopLogger,
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
		// A row written before the PR #271 assertion was tightened could land
		// in (summaryStatus=ready, summary=undefined). The aggregate adapter
		// must tolerate this on READ (so the orchestrator can re-transition
		// it back to pending) while the discriminated union prevents new
		// WRITES from ever producing this shape again.
		const client = createFakeClient(() => ({
			Item: {
				url: URL,
				summaryStatus: "ready",
			},
		}));
		const store = initDynamoDbArticleStore({
			client: client as DynamoDBDocumentClient,
			tableName: TABLE,
			logger: noopLogger,
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
		// Survives a row written before the assertion at
		// dynamodb-article-crawl.ts:41 was tightened. The aggregate adapter
		// tolerates the absent fields on read so old rows can flow through the
		// orchestrator at all; the writer-side discriminated union ensures new
		// writes are well-formed.
		const client = createFakeClient(() => ({
			Item: { url: URL, crawlStatus: "failed" },
		}));
		const store = initDynamoDbArticleStore({
			client: client as DynamoDBDocumentClient,
			tableName: TABLE,
			logger: noopLogger,
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
			logger: noopLogger,
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
			logger: noopLogger,
		});
		const loaded = await store.load(URL);
		expect(loaded?.summary).toEqual({ status: "failed", reason: "unknown" });
	});
});

describe("initDynamoDbArticleStore.save", () => {
	it("writes SET version=expected+1 and conditions on version=expected when expectedVersion > 0", async () => {
		let received: unknown;
		const client = createFakeClient((input) => {
			received = input;
			return {};
		});
		const store = initDynamoDbArticleStore({
			client: client as DynamoDBDocumentClient,
			tableName: TABLE,
			logger: noopLogger,
		});

		await store.save({
			article: buildArticle({ version: 5 }),
			expectedVersion: 5,
		});

		const cmd = received as UpdateInput;
		expect(cmd.input.UpdateExpression).toContain("version = :nextVersion");
		expect(cmd.input.ConditionExpression).toBe("version = :expectedVersion");
		expect(cmd.input.ExpressionAttributeValues?.[":nextVersion"]).toBe(6);
		expect(cmd.input.ExpressionAttributeValues?.[":expectedVersion"]).toBe(5);
	});

	it("permits the first aggregate write against a pre-aggregate row (attribute_not_exists(version))", async () => {
		let received: unknown;
		const client = createFakeClient((input) => {
			received = input;
			return {};
		});
		const store = initDynamoDbArticleStore({
			client: client as DynamoDBDocumentClient,
			tableName: TABLE,
			logger: noopLogger,
		});

		await store.save({
			article: buildArticle({ version: 0 }),
			expectedVersion: 0,
		});

		const cmd = received as UpdateInput;
		expect(cmd.input.ConditionExpression).toBe(
			"attribute_not_exists(version) OR version = :expectedVersion",
		);
		expect(cmd.input.ExpressionAttributeValues?.[":nextVersion"]).toBe(1);
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
			logger: noopLogger,
		});

		await store.save({
			article: buildArticle({
				summary: {
					status: "ready",
					summary: "Generated.",
					excerpt: "Excerpt.",
					inputTokens: 10,
					outputTokens: 5,
				},
			}),
			expectedVersion: 3,
		});

		const cmd = received as UpdateInput;
		// Summary ready payload must move atomically with status.
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
		// And every failure-side attribute is REMOVEd so the row can never be
		// (status=ready, summaryFailureReason=...) — the very pattern that
		// produced the 2026-05-10 forever-polling reader.
		expect(cmd.input.UpdateExpression).toContain("REMOVE");
		expect(cmd.input.UpdateExpression).toContain("summaryFailureReason");
		expect(cmd.input.UpdateExpression).toContain("summarySkippedReason");
	});

	it("for summary=pending, REMOVEs every payload attribute to prevent ready/missing-text drift", async () => {
		// This is the writer-side contract that makes the 2026-05-10 bug
		// impossible: a transition that moves summary back to pending MUST
		// drop the cached text, excerpt, and token counts so no later code
		// path sees an inconsistent (status=pending, summary="x") row.
		let received: unknown;
		const client = createFakeClient((input) => {
			received = input;
			return {};
		});
		const store = initDynamoDbArticleStore({
			client: client as DynamoDBDocumentClient,
			tableName: TABLE,
			logger: noopLogger,
		});

		await store.save({
			article: buildArticle({
				summary: { status: "pending" },
			}),
			expectedVersion: 1,
		});

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
			logger: noopLogger,
		});

		await store.save({
			article: buildArticle({
				crawl: {
					status: "failed",
					reason: "ETIMEDOUT",
					failedAt: "2026-05-10T12:00:00Z",
				},
			}),
			expectedVersion: 1,
		});

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
			logger: noopLogger,
		});

		await store.save({
			article: buildArticle({
				crawl: {
					status: "unsupported",
					reason: "application/pdf",
					failedAt: "2026-05-10T12:00:00Z",
				},
			}),
			expectedVersion: 1,
		});

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
			logger: noopLogger,
		});

		await store.save({
			article: buildArticle({ crawl: { status: "pending" } }),
			expectedVersion: 1,
		});

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
			logger: noopLogger,
		});

		await store.save({
			article: buildArticle({
				summary: { status: "failed", reason: "AI throttled" },
			}),
			expectedVersion: 1,
		});

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
			logger: noopLogger,
		});

		await store.save({
			article: buildArticle({
				summary: { status: "skipped", reason: "content-too-short" },
			}),
			expectedVersion: 1,
		});

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
			logger: noopLogger,
		});

		await store.save({
			article: buildArticle({ summary: { status: "skipped" } }),
			expectedVersion: 1,
		});

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
			logger: noopLogger,
		});

		await store.save({
			article: buildArticle({
				summary: {
					status: "ready",
					summary: "Generated.",
					inputTokens: 10,
					outputTokens: 5,
				},
			}),
			expectedVersion: 1,
		});

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
			logger: noopLogger,
		});

		await store.save({
			article: buildArticle({
				metadata: {
					title: "T",
					siteName: "example.com",
					excerpt: "E",
					wordCount: 100,
				},
			}),
			expectedVersion: 1,
		});

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
			logger: noopLogger,
		});

		await store.save({
			article: buildArticle({
				contentFetchedAt: undefined,
				etag: undefined,
				lastModified: undefined,
			}),
			expectedVersion: 1,
		});

		const cmd = received as UpdateInput;
		expect(cmd.input.UpdateExpression).toContain("contentFetchedAt");
		expect(cmd.input.UpdateExpression).toContain("etag");
		expect(cmd.input.UpdateExpression).toContain("lastModified");
	});

	it("translates ConditionalCheckFailedException into AggregateConcurrencyError", async () => {
		// This is the load-bearing translation: the orchestrator's retry budget
		// only fires on AggregateConcurrencyError. A bare DDB exception would
		// bypass the budget and surface directly to SQS for full-message retry.
		const client = createFakeClient(() => {
			throw new ConditionalCheckFailedException({
				$metadata: {},
				message: "conditional check failed",
			});
		});
		const store = initDynamoDbArticleStore({
			client: client as DynamoDBDocumentClient,
			tableName: TABLE,
			logger: noopLogger,
		});

		await expect(
			store.save({
				article: buildArticle(),
				expectedVersion: 3,
			}),
		).rejects.toBeInstanceOf(AggregateConcurrencyError);
	});

	it("emits a 'concurrency conflict' warning on conflict so operators can grep CloudWatch", async () => {
		const warnings: unknown[][] = [];
		const logger = {
			...noopLogger,
			warn: (...args: unknown[]) => {
				warnings.push(args);
			},
		};
		const client = createFakeClient(() => {
			throw new ConditionalCheckFailedException({
				$metadata: {},
				message: "conditional check failed",
			});
		});
		const store = initDynamoDbArticleStore({
			client: client as DynamoDBDocumentClient,
			tableName: TABLE,
			logger,
		});

		await expect(
			store.save({
				article: buildArticle(),
				expectedVersion: 3,
			}),
		).rejects.toBeInstanceOf(AggregateConcurrencyError);

		expect(warnings).toHaveLength(1);
		expect(String(warnings[0]?.[0])).toContain("concurrency conflict");
	});

	it("rethrows non-conditional errors without wrapping (e.g. DDB throttle)", async () => {
		const client = createFakeClient(() => {
			throw new Error("ProvisionedThroughputExceededException");
		});
		const store = initDynamoDbArticleStore({
			client: client as DynamoDBDocumentClient,
			tableName: TABLE,
			logger: noopLogger,
		});

		await expect(
			store.save({
				article: buildArticle(),
				expectedVersion: 1,
			}),
		).rejects.toThrow("ProvisionedThroughputExceededException");
	});
});
