import assert from "node:assert";
import type {
	BatchGetCommandInput,
	DeleteCommandInput,
	DynamoDBDocumentClient,
	PutCommandInput,
	QueryCommandInput,
	UpdateCommandInput,
} from "@aws-sdk/lib-dynamodb";
import {
	BatchGetCommand,
	DeleteCommand,
	GetCommand,
	PutCommand,
	QueryCommand,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { z } from "zod";

type Key = Record<string, string | number>;

/** Every command input minus `TableName` — the gateway supplies the name. */
type WithoutTable<T> = Omit<T, "TableName">;

export type DynamoTable<TSchema extends z.ZodObject> = {
	/**
	 * Fetch a single item by its primary key. Returns `undefined` if the item
	 * does not exist. The item is parsed through the row schema so every
	 * optional field is typed as `T | undefined` (never `null`).
	 */
	get: (
		key: Key,
		options?: { projection?: readonly (keyof z.infer<TSchema>)[] },
	) => Promise<z.infer<TSchema> | undefined>;

	/** Raw Put passthrough. Item is not parsed — writes bypass the read-side schema. */
	put: (input: WithoutTable<PutCommandInput>) => Promise<void>;

	/** Raw Update passthrough. */
	update: (input: WithoutTable<UpdateCommandInput>) => Promise<void>;

	/** Raw Delete passthrough. */
	delete: (input: WithoutTable<DeleteCommandInput>) => Promise<void>;

	/** Query passthrough. Returns items parsed through the row schema. */
	query: (input: WithoutTable<QueryCommandInput>) => Promise<z.infer<TSchema>[]>;
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
		async put(input) {
			await client.send(new PutCommand({ TableName: tableName, ...input }));
		},
		async update(input) {
			await client.send(new UpdateCommand({ TableName: tableName, ...input }));
		},
		async delete(input) {
			await client.send(new DeleteCommand({ TableName: tableName, ...input }));
		},
		async query(input) {
			const result = await client.send(
				new QueryCommand({ TableName: tableName, ...input }),
			);
			return (result.Items ?? []).map((item) => schema.parse(item));
		},
	};
}

/**
 * BatchGet across a single table. Items are parsed through the row schema.
 * Exposed as a top-level helper because BatchGetCommand is multi-table at the
 * SDK level but most callers only need single-table fan-out.
 */
export async function batchGetFromTable<TSchema extends z.ZodObject>(config: {
	client: DynamoDBDocumentClient;
	tableName: string;
	schema: TSchema;
	keys: readonly Key[];
	projection?: readonly (keyof z.infer<TSchema>)[];
}): Promise<z.infer<TSchema>[]> {
	const { client, tableName, schema, keys, projection } = config;
	if (keys.length === 0) return [];
	const input: BatchGetCommandInput = {
		RequestItems: {
			[tableName]: {
				Keys: keys as Key[],
				...(projection ? { ProjectionExpression: projection.join(", ") } : {}),
			},
		},
	};
	const result = await client.send(new BatchGetCommand(input));
	const items = result.Responses?.[tableName] ?? [];
	return items.map((item) => schema.parse(item));
}

/** Re-exported so composition roots can type the client without importing the SDK. */
export type { DynamoDBDocumentClient };

/**
 * Assertion helper for callers that expect a row to exist. Use when absence
 * is a bug (not a not-found). Narrows `T | undefined` to `T`.
 */
export function assertItem<T>(item: T | undefined, message: string): asserts item is T {
	assert(item !== undefined, message);
}
