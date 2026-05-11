import {
	ConditionalCheckFailedException,
	type DynamoDBDocumentClient,
} from "@packages/hutch-storage-client";
import { initDynamoDbGeneratedSummary } from "./dynamodb-generated-summary";

type SendFn = DynamoDBDocumentClient["send"];

type CapturedCommand = {
	input: {
		Key?: Record<string, unknown>;
		UpdateExpression?: string;
		ConditionExpression?: string;
		ExpressionAttributeValues?: Record<string, unknown>;
	};
};

function createFakeClient(impl: (input: unknown) => unknown): Partial<DynamoDBDocumentClient> {
	return {
		send: (async (input: unknown) => impl(input)) as unknown as SendFn,
	};
}

function createCapturingClient(): {
	client: Partial<DynamoDBDocumentClient>;
	commands: CapturedCommand[];
} {
	const commands: CapturedCommand[] = [];
	const client = createFakeClient((input) => {
		commands.push(input as CapturedCommand);
		return {};
	});
	return { client, commands };
}

const TABLE = "test-articles";
const URL = "https://example.com/article";

function clientForGet(item: Record<string, unknown> | undefined): Partial<DynamoDBDocumentClient> {
	return createFakeClient(() => ({ Item: item }));
}

describe("initDynamoDbGeneratedSummary (unit)", () => {
	describe("findGeneratedSummary", () => {
		it("returns undefined when no row exists", async () => {
			const { findGeneratedSummary } = initDynamoDbGeneratedSummary({
				client: clientForGet(undefined) as DynamoDBDocumentClient,
				tableName: TABLE,
			});
			expect(await findGeneratedSummary(URL)).toBeUndefined();
		});

		it("returns pending when status=pending", async () => {
			const { findGeneratedSummary } = initDynamoDbGeneratedSummary({
				client: clientForGet({ summaryStatus: "pending" }) as DynamoDBDocumentClient,
				tableName: TABLE,
			});
			expect(await findGeneratedSummary(URL)).toEqual({ status: "pending" });
		});

		it("returns ready with summary only when summaryExcerpt is absent", async () => {
			const { findGeneratedSummary } = initDynamoDbGeneratedSummary({
				client: clientForGet({ summaryStatus: "ready", summary: "done" }) as DynamoDBDocumentClient,
				tableName: TABLE,
			});
			expect(await findGeneratedSummary(URL)).toEqual({ status: "ready", summary: "done" });
		});

		it("returns ready with both summary and excerpt when summaryStatus is set and excerpt is present", async () => {
			// Why this matters: covers the explicit summaryStatus="ready"
			// branch with the excerpt-truthy sub-branch — the path the
			// production summariser hits on every fresh save once
			// `saveGeneratedSummary` writes summary, summaryExcerpt and
			// summaryStatus together. Without this test the new ready branch's
			// `if (row.summaryExcerpt)` true side stays uncovered and the
			// 100% branch threshold trips.
			const { findGeneratedSummary } = initDynamoDbGeneratedSummary({
				client: clientForGet({
					summaryStatus: "ready",
					summary: "done",
					summaryExcerpt: "blurb",
				}) as DynamoDBDocumentClient,
				tableName: TABLE,
			});
			expect(await findGeneratedSummary(URL)).toEqual({
				status: "ready",
				summary: "done",
				excerpt: "blurb",
			});
		});

		it("throws when summaryStatus=ready is persisted without summary text (data inconsistency)", async () => {
			// Why this matters: this is the exact state the
			// fagnerbrack.com/why-developers-become-frustrated-… row was left in
			// after the 2026-05-10 freshness refresh ran an UpdateExpression that
			// REMOVEd `summary` without resetting `summaryStatus`. With the
			// previous code path the mapper silently returned undefined and the
			// reader UI rendered "Generating summary…" forever. The explicit
			// assert turns that silent stuck-pending state into a loud error
			// the moment any future writer reintroduces the same inconsistency.
			const { findGeneratedSummary } = initDynamoDbGeneratedSummary({
				client: clientForGet({ summaryStatus: "ready" }) as DynamoDBDocumentClient,
				tableName: TABLE,
			});
			await expect(findGeneratedSummary(URL)).rejects.toThrow(
				"summaryStatus=ready row must carry a summary",
			);
		});

		it("returns failed with reason when status=failed", async () => {
			const { findGeneratedSummary } = initDynamoDbGeneratedSummary({
				client: clientForGet({
					summaryStatus: "failed",
					summaryFailureReason: "deepseek timeout",
				}) as DynamoDBDocumentClient,
				tableName: TABLE,
			});
			expect(await findGeneratedSummary(URL)).toEqual({
				status: "failed",
				reason: "deepseek timeout",
			});
		});

		it("returns skipped without reason when status=skipped and no skip reason persisted", async () => {
			const { findGeneratedSummary } = initDynamoDbGeneratedSummary({
				client: clientForGet({ summaryStatus: "skipped" }) as DynamoDBDocumentClient,
				tableName: TABLE,
			});
			expect(await findGeneratedSummary(URL)).toEqual({ status: "skipped" });
		});

		it("returns skipped with reason when summarySkippedReason is present", async () => {
			const { findGeneratedSummary } = initDynamoDbGeneratedSummary({
				client: clientForGet({
					summaryStatus: "skipped",
					summarySkippedReason: "content-too-short",
				}) as DynamoDBDocumentClient,
				tableName: TABLE,
			});
			expect(await findGeneratedSummary(URL)).toEqual({
				status: "skipped",
				reason: "content-too-short",
			});
		});

		it("returns ready for a legacy row (summary present, no status)", async () => {
			const { findGeneratedSummary } = initDynamoDbGeneratedSummary({
				client: clientForGet({ summary: "legacy" }) as DynamoDBDocumentClient,
				tableName: TABLE,
			});
			expect(await findGeneratedSummary(URL)).toEqual({ status: "ready", summary: "legacy" });
		});

		it("returns undefined for a legacy row that has neither summaryStatus nor summary", async () => {
			// Legacy rows pre-date the summary state machine. Return undefined so
			// the caller (summariser or view handler) can treat the row as
			// untouched and re-prime the pipeline instead of treating it as
			// actively pending.
			const { findGeneratedSummary } = initDynamoDbGeneratedSummary({
				client: clientForGet({}) as DynamoDBDocumentClient,
				tableName: TABLE,
			});
			expect(await findGeneratedSummary(URL)).toBeUndefined();
		});

		it("canonicalises tracking-param variants to the same Key.url", async () => {
			// The wrapper delegates URL canonicalization to ArticleResourceUniqueId
			// (covered exhaustively in @packages/article-resource-unique-id). This
			// case is a regression guard that the wrapper actually applies it —
			// every variant must produce the same Key.url, otherwise DDB rows
			// would fragment per tracking-param combination.
			const captures: Array<Record<string, unknown> | undefined> = [];
			const client = createFakeClient((input) => {
				captures.push((input as CapturedCommand).input.Key);
				return { Item: undefined };
			});
			const { findGeneratedSummary } = initDynamoDbGeneratedSummary({
				client: client as DynamoDBDocumentClient,
				tableName: TABLE,
			});

			const canonical = "https://example.com/article";
			await findGeneratedSummary(canonical);
			await findGeneratedSummary(`${canonical}?source=friends_link&sk=abc123`);
			await findGeneratedSummary(`${canonical}?utm_source=twitter&utm_medium=social`);

			expect(captures).toHaveLength(3);
			expect(captures[0]).toEqual(captures[1]);
			expect(captures[0]).toEqual(captures[2]);
		});
	});

	describe("saveGeneratedSummary", () => {
		it("writes summary, excerpt, token counts, and status=ready", async () => {
			const { client, commands } = createCapturingClient();
			const { saveGeneratedSummary } = initDynamoDbGeneratedSummary({
				client: client as DynamoDBDocumentClient,
				tableName: TABLE,
			});

			await saveGeneratedSummary({
				url: URL,
				summary: "done",
				excerpt: "blurb",
				inputTokens: 100,
				outputTokens: 50,
			});

			expect(commands).toHaveLength(1);
			const update = commands[0].input;
			expect(update.UpdateExpression).toContain("summary = :summary");
			expect(update.UpdateExpression).toContain("summaryExcerpt = :excerpt");
			expect(update.UpdateExpression).toContain("summaryInputTokens = :inputTokens");
			expect(update.UpdateExpression).toContain("summaryOutputTokens = :outputTokens");
			expect(update.UpdateExpression).toContain("summaryStatus = :ready");
			expect(update.ExpressionAttributeValues?.[":summary"]).toBe("done");
			expect(update.ExpressionAttributeValues?.[":excerpt"]).toBe("blurb");
			expect(update.ExpressionAttributeValues?.[":inputTokens"]).toBe(100);
			expect(update.ExpressionAttributeValues?.[":outputTokens"]).toBe(50);
			expect(update.ExpressionAttributeValues?.[":ready"]).toBe("ready");
		});

		it("clears prior failure and skip reasons via REMOVE so a successful redrive wipes stale markers", async () => {
			// Regression guard: the prior integration tests asserted that
			// markSummaryFailed → saveGeneratedSummary cleared summaryFailureReason
			// and that a seeded skipped row's summarySkippedReason was wiped on
			// forced retry. Both reduce to the same UpdateExpression shape — if
			// either REMOVE attribute is dropped the read side will surface a
			// stale failure/skip reason after the row has flipped to ready.
			const { client, commands } = createCapturingClient();
			const { saveGeneratedSummary } = initDynamoDbGeneratedSummary({
				client: client as DynamoDBDocumentClient,
				tableName: TABLE,
			});

			await saveGeneratedSummary({
				url: URL,
				summary: "done",
				excerpt: "blurb",
				inputTokens: 1,
				outputTokens: 2,
			});

			expect(commands[0].input.UpdateExpression).toContain(
				"REMOVE summaryFailureReason, summarySkippedReason",
			);
		});
	});

	describe("markSummaryPending", () => {
		it("sets summaryStatus=pending under a guard that never clobbers a ready row", async () => {
			const { client, commands } = createCapturingClient();
			const { markSummaryPending } = initDynamoDbGeneratedSummary({
				client: client as DynamoDBDocumentClient,
				tableName: TABLE,
			});

			await markSummaryPending({ url: URL });

			expect(commands).toHaveLength(1);
			const update = commands[0].input;
			expect(update.UpdateExpression).toBe("SET summaryStatus = :pending");
			expect(update.ConditionExpression).toContain("attribute_not_exists(summaryStatus)");
			expect(update.ConditionExpression).toContain("summaryStatus <> :ready");
			expect(update.ExpressionAttributeValues?.[":pending"]).toBe("pending");
			expect(update.ExpressionAttributeValues?.[":ready"]).toBe("ready");
		});
	});

	describe("markSummaryFailed", () => {
		it("sets summaryStatus=failed with reason, guarded so ready/skipped rows cannot regress", async () => {
			const { client, commands } = createCapturingClient();
			const { markSummaryFailed } = initDynamoDbGeneratedSummary({
				client: client as DynamoDBDocumentClient,
				tableName: TABLE,
			});

			await markSummaryFailed({ url: URL, reason: "deepseek timeout" });

			expect(commands).toHaveLength(1);
			const update = commands[0].input;
			expect(update.UpdateExpression).toContain("summaryStatus = :failed");
			expect(update.UpdateExpression).toContain("summaryFailureReason = :reason");
			expect(update.ConditionExpression).toContain("attribute_not_exists(summaryStatus)");
			expect(update.ConditionExpression).toContain("summaryStatus = :pending");
			expect(update.ConditionExpression).toContain("summaryStatus = :failed");
			expect(update.ExpressionAttributeValues?.[":failed"]).toBe("failed");
			expect(update.ExpressionAttributeValues?.[":pending"]).toBe("pending");
			expect(update.ExpressionAttributeValues?.[":reason"]).toBe("deepseek timeout");
		});
	});

	describe("markSummarySkipped", () => {
		it("sets summaryStatus=skipped with reason, guarded so only new or pending rows transition", async () => {
			const { client, commands } = createCapturingClient();
			const { markSummarySkipped } = initDynamoDbGeneratedSummary({
				client: client as DynamoDBDocumentClient,
				tableName: TABLE,
			});

			await markSummarySkipped({ url: URL, reason: "content-too-short" });

			expect(commands).toHaveLength(1);
			const update = commands[0].input;
			expect(update.UpdateExpression).toContain("summaryStatus = :skipped");
			expect(update.UpdateExpression).toContain("summarySkippedReason = :reason");
			expect(update.ConditionExpression).toContain("attribute_not_exists(summaryStatus)");
			expect(update.ConditionExpression).toContain("summaryStatus = :pending");
			expect(update.ExpressionAttributeValues?.[":skipped"]).toBe("skipped");
			expect(update.ExpressionAttributeValues?.[":pending"]).toBe("pending");
			expect(update.ExpressionAttributeValues?.[":reason"]).toBe("content-too-short");
		});
	});

	describe("markSummaryStage", () => {
		it("issues an unconditional UpdateItem that sets summaryStage", async () => {
			const { client, commands } = createCapturingClient();
			const { markSummaryStage } = initDynamoDbGeneratedSummary({
				client: client as DynamoDBDocumentClient,
				tableName: TABLE,
			});

			await markSummaryStage({ url: URL, stage: "summary-generating" });

			expect(commands).toHaveLength(1);
			const update = commands[0].input;
			expect(update.UpdateExpression).toBe("SET summaryStage = :stage");
			expect(update.ConditionExpression).toBeUndefined();
			expect(update.ExpressionAttributeValues?.[":stage"]).toBe("summary-generating");
		});
	});

	describe("mark functions — error handling", () => {
		it("swallows ConditionalCheckFailedException (ready row preserved)", async () => {
			const client = createFakeClient(() => {
				throw new ConditionalCheckFailedException({
					$metadata: {},
					message: "condition failed",
				});
			});
			const { markSummaryPending, markSummaryFailed, markSummarySkipped } =
				initDynamoDbGeneratedSummary({
					client: client as DynamoDBDocumentClient,
					tableName: TABLE,
				});

			await expect(markSummaryPending({ url: URL })).resolves.toBeUndefined();
			await expect(markSummaryFailed({ url: URL, reason: "r" })).resolves.toBeUndefined();
			await expect(
				markSummarySkipped({ url: URL, reason: "content-too-short" }),
			).resolves.toBeUndefined();
		});

		it("rethrows non-ConditionalCheck errors", async () => {
			const client = createFakeClient(() => {
				throw new Error("throttled");
			});
			const { markSummaryPending, markSummaryFailed, markSummarySkipped } =
				initDynamoDbGeneratedSummary({
					client: client as DynamoDBDocumentClient,
					tableName: TABLE,
				});

			await expect(markSummaryPending({ url: URL })).rejects.toThrow("throttled");
			await expect(markSummaryFailed({ url: URL, reason: "r" })).rejects.toThrow("throttled");
			await expect(
				markSummarySkipped({ url: URL, reason: "content-too-short" }),
			).rejects.toThrow("throttled");
		});
	});
});
