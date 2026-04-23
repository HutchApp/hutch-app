import {
	ConditionalCheckFailedException,
	type DynamoDBDocumentClient,
} from "@packages/hutch-storage-client";
import { initDynamoDbGeneratedSummary } from "./dynamodb-generated-summary";

type SendFn = DynamoDBDocumentClient["send"];

function createFakeClient(impl: (input: unknown) => unknown): Partial<DynamoDBDocumentClient> {
	return {
		send: (async (input: unknown) => impl(input)) as unknown as SendFn,
	};
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

		it("returns ready when status=ready with summary", async () => {
			const { findGeneratedSummary } = initDynamoDbGeneratedSummary({
				client: clientForGet({ summaryStatus: "ready", summary: "done" }) as DynamoDBDocumentClient,
				tableName: TABLE,
			});
			expect(await findGeneratedSummary(URL)).toEqual({ status: "ready", summary: "done" });
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

		it("returns skipped when status=skipped", async () => {
			const { findGeneratedSummary } = initDynamoDbGeneratedSummary({
				client: clientForGet({ summaryStatus: "skipped" }) as DynamoDBDocumentClient,
				tableName: TABLE,
			});
			expect(await findGeneratedSummary(URL)).toEqual({ status: "skipped" });
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
	});

	describe("saveGeneratedSummary", () => {
		it("issues an UpdateItem that sets summary and status=ready", async () => {
			let received: unknown;
			const client = createFakeClient((input) => {
				received = input;
				return {};
			});
			const { saveGeneratedSummary } = initDynamoDbGeneratedSummary({
				client: client as DynamoDBDocumentClient,
				tableName: TABLE,
			});

			await saveGeneratedSummary({ url: URL, summary: "done", inputTokens: 1, outputTokens: 2 });

			expect(received).toBeDefined();
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
			await expect(markSummarySkipped({ url: URL })).resolves.toBeUndefined();
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
			await expect(markSummarySkipped({ url: URL })).rejects.toThrow("throttled");
		});
	});
});
