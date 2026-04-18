import assert from "node:assert";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import type { z } from "zod";

export type DynamoTable<TSchema extends z.ZodObject> = {
	/**
	 * Fetch a single item by its primary key. Returns `undefined` if the item
	 * does not exist. The item is parsed through the row schema so every
	 * optional field is typed as `T | undefined` (never `null`).
	 */
	get: (
		key: Record<string, string>,
		options?: { projection?: readonly (keyof z.infer<TSchema>)[] },
	) => Promise<z.infer<TSchema> | undefined>;
};

/**
 * Create a typed gateway for a single DynamoDB table. All item reads are
 * funnelled through the provided Zod schema — the schema is the single
 * source of truth for which attributes are required vs. optional.
 *
 * For optional attributes, use `dynamoField(z.string())` instead of
 * `z.string().optional()` so that `null` values stored by DynamoDB are
 * accepted and normalized.
 */
export function defineDynamoTable<TSchema extends z.ZodObject>(config: {
	client: DynamoDBDocumentClient;
	tableName: string;
	schema: TSchema;
}): DynamoTable<TSchema> {
	const { client, tableName, schema } = config;

	return {
		async get(key, options) {
			const projection = options?.projection?.join(", ");
			const result = await client.send(
				new GetCommand({
					TableName: tableName,
					Key: key,
					...(projection ? { ProjectionExpression: projection } : {}),
				}),
			);
			if (!result.Item) return undefined;
			return schema.parse(result.Item);
		},
	};
}

/** Re-exported for composition-root typing only. */
export type { DynamoDBDocumentClient };

/**
 * Helper that asserts a DynamoDB GetCommand returned an item. Use when
 * callers require the row to exist (absence is a bug, not a not-found).
 */
export function assertItem<T>(item: T | undefined, message: string): asserts item is T {
	assert(item !== undefined, message);
}
