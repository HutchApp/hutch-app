import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { initDynamoDbSummaryCache } from "./dynamodb-summary-cache";

function createFakeClient(item: Record<string, unknown> | undefined): Partial<DynamoDBDocumentClient> {
	return {
		send: async () => ({ Item: item }),
	};
}

describe("initDynamoDbSummaryCache", () => {
	it("should return empty string when article exists without summary because summary is generated asynchronously", async () => {
		const client = createFakeClient({ url: "https://example.com/article" });
		const { findCachedSummary } = initDynamoDbSummaryCache({
			client: client as typeof client & DynamoDBDocumentClient,
			tableName: "test-table",
		});

		const result = await findCachedSummary("https://example.com/article");

		expect(result).toBe("");
	});
});
