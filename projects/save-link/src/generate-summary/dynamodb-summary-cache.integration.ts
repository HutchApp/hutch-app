import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { initDynamoDbSummaryCache } from "./dynamodb-summary-cache";
import { LinkId } from "../save-link/link-id";

// process.env used directly — same exception as Playwright configs:
// importing requireEnv causes the node-test process to load require-env.ts
// outside c8 V8 coverage, creating uncovered function entries that break thresholds
const tableName = process.env.DYNAMODB_ARTICLES_TABLE;
assert(tableName);

describe("dynamoDbSummaryCache (integration)", () => {
	it("returns empty string when no item exists", async () => {
		const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
		const { findCachedSummary } = initDynamoDbSummaryCache({ client, tableName });

		const nonExistentUrl = `https://example.com/${randomUUID()}`;
		const result = await findCachedSummary(nonExistentUrl);

		assert.equal(result, "");
	});

	it("saves and retrieves a cached summary", async () => {
		const tableName = process.env.DYNAMODB_ARTICLES_TABLE;
		assert(tableName);

		const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
		const { findCachedSummary, saveCachedSummary } = initDynamoDbSummaryCache({ client, tableName });

		const url = `https://example.com/${randomUUID()}`;

		await saveCachedSummary({ url, summary: "A test summary", inputTokens: 100, outputTokens: 50 });

		const result = await findCachedSummary(url);
		assert.equal(result, "A test summary");
	});

	it("returns empty string when item exists without summary attribute", async () => {
		const tableName = process.env.DYNAMODB_ARTICLES_TABLE;
		assert(tableName);

		const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
		const { findCachedSummary } = initDynamoDbSummaryCache({ client, tableName });

		const url = `https://example.com/${randomUUID()}`;
		await client.send(new PutCommand({
			TableName: tableName,
			Item: { url: LinkId.from(url) },
		}));

		const result = await findCachedSummary(url);
		assert.equal(result, "");
	});
});
