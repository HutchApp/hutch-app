import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { initDynamoDbSummaryCache } from "./dynamodb-summary-cache";
import { ArticleResourceUniqueId } from "../save-link/article-resource-unique-id";

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
			Item: { url: ArticleResourceUniqueId.parse(url).value },
		}));

		const result = await findCachedSummary(url);
		assert.equal(result, "");
	});

	it("dedupes tracking-param variants to the same cached summary row", async () => {
		const tableName = process.env.DYNAMODB_ARTICLES_TABLE;
		assert(tableName);

		const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
		const { findCachedSummary, saveCachedSummary } = initDynamoDbSummaryCache({ client, tableName });

		const canonical = `https://example.com/${randomUUID()}`;
		const friendsLink = `${canonical}?source=friends_link&sk=af337097bd3ecac5750a7fb1dcd0b91d`;
		const utmVariant = `${canonical}?utm_source=twitter&utm_medium=social`;

		await saveCachedSummary({ url: friendsLink, summary: "Deduped summary", inputTokens: 10, outputTokens: 5 });

		assert.equal(await findCachedSummary(canonical), "Deduped summary");
		assert.equal(await findCachedSummary(friendsLink), "Deduped summary");
		assert.equal(await findCachedSummary(utmVariant), "Deduped summary");
	});
});
