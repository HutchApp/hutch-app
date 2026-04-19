import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	createDynamoDocumentClient,
	defineDynamoTable,
	dynamoField,
} from "@packages/hutch-storage-client";
import { z } from "zod";
import { initDynamoDbGeneratedSummary } from "./dynamodb-generated-summary";
import { ArticleResourceUniqueId } from "../save-link/article-resource-unique-id";

// process.env used directly — same exception as Playwright configs:
// importing requireEnv causes the node-test process to load require-env.ts
// outside c8 V8 coverage, creating uncovered function entries that break thresholds
const tableName = process.env.DYNAMODB_ARTICLES_TABLE;
assert(tableName);

const SeedRow = z.object({
	url: z.string(),
	summary: dynamoField(z.string()),
});

describe("dynamoDbGeneratedSummary (integration)", () => {
	it("returns undefined when no item exists", async () => {
		const client = createDynamoDocumentClient();
		const { findGeneratedSummary } = initDynamoDbGeneratedSummary({ client, tableName });

		const nonExistentUrl = `https://example.com/${randomUUID()}`;
		const result = await findGeneratedSummary(nonExistentUrl);

		assert.equal(result, undefined);
	});

	it("saves and retrieves a cached summary with ready status", async () => {
		const client = createDynamoDocumentClient();
		const { findGeneratedSummary, saveGeneratedSummary } = initDynamoDbGeneratedSummary({ client, tableName });

		const url = `https://example.com/${randomUUID()}`;
		await saveGeneratedSummary({ url, summary: "A test summary", inputTokens: 100, outputTokens: 50 });

		const result = await findGeneratedSummary(url);
		assert.deepEqual(result, { status: "ready", summary: "A test summary" });
	});

	it("treats a legacy row (summary present, no summaryStatus) as ready", async () => {
		const client = createDynamoDocumentClient();
		const seedTable = defineDynamoTable({ client, tableName, schema: SeedRow });
		const { findGeneratedSummary } = initDynamoDbGeneratedSummary({ client, tableName });

		const url = `https://example.com/${randomUUID()}`;
		await seedTable.put({
			Item: {
				url: ArticleResourceUniqueId.parse(url).value,
				summary: "Legacy summary",
			},
		});

		const result = await findGeneratedSummary(url);
		assert.deepEqual(result, { status: "ready", summary: "Legacy summary" });
	});

	it("treats a bare row (no summary, no summaryStatus) as pending", async () => {
		const client = createDynamoDocumentClient();
		const seedTable = defineDynamoTable({ client, tableName, schema: SeedRow });
		const { findGeneratedSummary } = initDynamoDbGeneratedSummary({ client, tableName });

		const url = `https://example.com/${randomUUID()}`;
		await seedTable.put({ Item: { url: ArticleResourceUniqueId.parse(url).value } });

		const result = await findGeneratedSummary(url);
		assert.deepEqual(result, { status: "pending" });
	});

	it("marks a new row as pending", async () => {
		const client = createDynamoDocumentClient();
		const { findGeneratedSummary, markSummaryPending } = initDynamoDbGeneratedSummary({ client, tableName });

		const url = `https://example.com/${randomUUID()}`;
		await markSummaryPending({ url });

		const result = await findGeneratedSummary(url);
		assert.deepEqual(result, { status: "pending" });
	});

	it("markSummaryPending does not clobber a ready row", async () => {
		const client = createDynamoDocumentClient();
		const { findGeneratedSummary, saveGeneratedSummary, markSummaryPending } =
			initDynamoDbGeneratedSummary({ client, tableName });

		const url = `https://example.com/${randomUUID()}`;
		await saveGeneratedSummary({ url, summary: "Ready summary", inputTokens: 10, outputTokens: 5 });
		await markSummaryPending({ url });

		const result = await findGeneratedSummary(url);
		assert.deepEqual(result, { status: "ready", summary: "Ready summary" });
	});

	it("markSummaryFailed flips pending to failed with reason", async () => {
		const client = createDynamoDocumentClient();
		const { findGeneratedSummary, markSummaryPending, markSummaryFailed } =
			initDynamoDbGeneratedSummary({ client, tableName });

		const url = `https://example.com/${randomUUID()}`;
		await markSummaryPending({ url });
		await markSummaryFailed({ url, reason: "deepseek timeout" });

		const result = await findGeneratedSummary(url);
		assert.deepEqual(result, { status: "failed", reason: "deepseek timeout" });
	});

	it("markSummaryFailed does not regress a ready row", async () => {
		const client = createDynamoDocumentClient();
		const { findGeneratedSummary, saveGeneratedSummary, markSummaryFailed } =
			initDynamoDbGeneratedSummary({ client, tableName });

		const url = `https://example.com/${randomUUID()}`;
		await saveGeneratedSummary({ url, summary: "Ready summary", inputTokens: 10, outputTokens: 5 });
		await markSummaryFailed({ url, reason: "late failure" });

		const result = await findGeneratedSummary(url);
		assert.deepEqual(result, { status: "ready", summary: "Ready summary" });
	});

	it("markSummarySkipped flips pending to skipped", async () => {
		const client = createDynamoDocumentClient();
		const { findGeneratedSummary, markSummaryPending, markSummarySkipped } =
			initDynamoDbGeneratedSummary({ client, tableName });

		const url = `https://example.com/${randomUUID()}`;
		await markSummaryPending({ url });
		await markSummarySkipped({ url });

		const result = await findGeneratedSummary(url);
		assert.deepEqual(result, { status: "skipped" });
	});

	it("saveGeneratedSummary clears a prior failure reason when the retry succeeds", async () => {
		const client = createDynamoDocumentClient();
		const { findGeneratedSummary, markSummaryPending, markSummaryFailed, saveGeneratedSummary } =
			initDynamoDbGeneratedSummary({ client, tableName });

		const url = `https://example.com/${randomUUID()}`;
		await markSummaryPending({ url });
		await markSummaryFailed({ url, reason: "transient" });
		await saveGeneratedSummary({ url, summary: "Recovered", inputTokens: 10, outputTokens: 5 });

		const result = await findGeneratedSummary(url);
		assert.deepEqual(result, { status: "ready", summary: "Recovered" });
	});

	it("dedupes tracking-param variants to the same cached summary row", async () => {
		const client = createDynamoDocumentClient();
		const { findGeneratedSummary, saveGeneratedSummary } = initDynamoDbGeneratedSummary({ client, tableName });

		const canonical = `https://example.com/${randomUUID()}`;
		const friendsLink = `${canonical}?source=friends_link&sk=af337097bd3ecac5750a7fb1dcd0b91d`;
		const utmVariant = `${canonical}?utm_source=twitter&utm_medium=social`;

		await saveGeneratedSummary({ url: friendsLink, summary: "Deduped summary", inputTokens: 10, outputTokens: 5 });

		assert.deepEqual(await findGeneratedSummary(canonical), {
			status: "ready",
			summary: "Deduped summary",
		});
		assert.deepEqual(await findGeneratedSummary(friendsLink), {
			status: "ready",
			summary: "Deduped summary",
		});
		assert.deepEqual(await findGeneratedSummary(utmVariant), {
			status: "ready",
			summary: "Deduped summary",
		});
	});
});
