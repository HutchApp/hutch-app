import type { DynamoDBDocumentClient } from "@packages/hutch-storage-client";
import { initDynamoDbAuth } from "./dynamodb-auth";

/** Fake that honours the GetCommand projection so a row with fields missing from it round-trips as real DynamoDB would. */
function createFakeClient(
	storedRow: Record<string, unknown>,
): Partial<DynamoDBDocumentClient> {
	return {
		send: (async (command: {
			input: { ExpressionAttributeNames: Record<string, string> };
		}) => {
			const attrs = Object.values(command.input.ExpressionAttributeNames);
			const Item = Object.fromEntries(attrs.map((a) => [a, storedRow[a]]));
			return { Item };
		}) as DynamoDBDocumentClient["send"],
	};
}

describe("initDynamoDbAuth", () => {
	describe("findUserByEmail", () => {
		it("returns the user when the row exists", async () => {
			const client = createFakeClient({
				email: "existing@example.com",
				userId: "abc123",
				passwordHash: "hashed",
				emailVerified: true,
				registeredAt: "2026-04-20T00:00:00.000Z",
			});
			const auth = initDynamoDbAuth({
				client: client as typeof client & DynamoDBDocumentClient,
				usersTableName: "users",
				sessionsTableName: "sessions",
			});

			const result = await auth.findUserByEmail("existing@example.com");

			expect(result).toEqual({
				userId: "abc123",
				emailVerified: true,
				registeredAt: "2026-04-20T00:00:00.000Z",
			});
		});
	});
});
