import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	createDynamoDocumentClient,
	defineDynamoTable,
	dynamoField,
} from "@packages/hutch-storage-client";
import { z } from "zod";
import { initFindArticleContent } from "./find-article-content";
import { ArticleResourceUniqueId } from "./article-resource-unique-id";

// process.env used directly — same exception as Playwright configs:
// importing requireEnv causes the node-test process to load require-env.ts
// outside Jest V8 coverage, creating uncovered function entries that break thresholds
const tableName = process.env.DYNAMODB_ARTICLES_TABLE;
assert(tableName);

const expectedContent = "<p>Integration test content</p>";

const stubS3Client = {
	send: async () => ({
		Body: { transformToString: async () => expectedContent },
	}),
};

const SeedRow = z.object({
	url: z.string(),
	contentLocation: dynamoField(z.string()),
});

describe("findArticleContent (integration)", () => {
	it("retrieves content from S3 using contentLocation stored in DynamoDB", async () => {
		const dynamoClient = createDynamoDocumentClient();
		const seedTable = defineDynamoTable({ client: dynamoClient, tableName, schema: SeedRow });

		const { findArticleContent } = initFindArticleContent({
			dynamoClient,
			s3Client: stubS3Client as never,
			tableName,
		});

		const uniqueUrl = `https://example.com/${randomUUID()}`;
		const articleResourceUniqueId = ArticleResourceUniqueId.parse(uniqueUrl);

		await seedTable.put({
			Item: {
				url: articleResourceUniqueId.value,
				contentLocation: "s3://test-bucket/content/test/content.html",
			},
		});

		const result = await findArticleContent(uniqueUrl);

		assert(result);
		assert.equal(result.content, expectedContent);
	});

	it("returns undefined when contentLocation is absent", async () => {
		const dynamoClient = createDynamoDocumentClient();
		const seedTable = defineDynamoTable({ client: dynamoClient, tableName, schema: SeedRow });

		const { findArticleContent } = initFindArticleContent({
			dynamoClient,
			s3Client: stubS3Client as never,
			tableName,
		});

		const uniqueUrl = `https://example.com/${randomUUID()}`;
		const articleResourceUniqueId = ArticleResourceUniqueId.parse(uniqueUrl);

		await seedTable.put({
			Item: { url: articleResourceUniqueId.value },
		});

		const result = await findArticleContent(uniqueUrl);
		assert.equal(result, undefined);
	});
});
