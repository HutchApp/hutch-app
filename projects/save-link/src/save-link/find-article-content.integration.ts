import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { initFindArticleContent } from "./find-article-content";
import { ArticleUniqueId } from "./article-unique-id";

// process.env used directly — same exception as Playwright configs:
// importing requireEnv causes the node-test process to load require-env.ts
// outside Jest V8 coverage, creating uncovered function entries that break thresholds
const tableName = process.env.DYNAMODB_ARTICLES_TABLE;
assert(tableName);

describe("findArticleContent (integration)", () => {
	it("retrieves content for a saved article", async () => {
		const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
		const { findArticleContent } = initFindArticleContent({ client, tableName });

		const uniqueUrl = `https://example.com/${randomUUID()}`;
		const expectedContent = "<p>Integration test content</p>";

		await client.send(
			new PutCommand({
				TableName: tableName,
				Item: {
					url: ArticleUniqueId.parse(uniqueUrl).value,
					content: expectedContent,
				},
			}),
		);

		const result = await findArticleContent(uniqueUrl);

		assert(result);
		assert.equal(result.content, expectedContent);
	});
});
