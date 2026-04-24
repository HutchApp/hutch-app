/* c8 ignore start -- thin AWS SDK wrapper, tested via integration */
import assert from "node:assert";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import type { S3Client } from "@aws-sdk/client-s3";
import {
	type DynamoDBDocumentClient,
	defineDynamoTable,
	dynamoField,
} from "@packages/hutch-storage-client";
import { z } from "zod";
import { ArticleResourceUniqueId } from "../save-link/article-resource-unique-id";
import type { ReadCanonicalContent } from "./canonical-content.types";

const CanonicalRow = z.object({
	title: dynamoField(z.string()),
	wordCount: dynamoField(z.number()),
	contentLocation: dynamoField(z.string()),
});

export function initReadCanonicalContent(deps: {
	dynamoClient: DynamoDBDocumentClient;
	s3Client: S3Client;
	tableName: string;
	bucketName: string;
}): { readCanonicalContent: ReadCanonicalContent } {
	const { dynamoClient, s3Client, tableName, bucketName } = deps;

	const articleTable = defineDynamoTable({
		client: dynamoClient,
		tableName,
		schema: CanonicalRow,
	});

	const readCanonicalContent: ReadCanonicalContent = async (params) => {
		const articleResourceUniqueId = ArticleResourceUniqueId.parse(params.url);
		const row = await articleTable.get(
			{ url: articleResourceUniqueId.value },
			{ projection: ["title", "wordCount", "contentLocation"] },
		);
		// `contentLocation` is set only after a worker writes canonical content.
		// The stub row created at /save-html submission has title/wordCount but
		// no contentLocation, so it correctly reads as "no canonical yet".
		if (!row?.contentLocation) return undefined;

		// title and wordCount are written atomically with contentLocation in
		// promoteSourceToCanonical, so their presence here is an invariant —
		// fail fast rather than masking a corrupted row with empty strings.
		assert(row.title !== undefined, "canonical row must have title when contentLocation is set");
		assert(row.wordCount !== undefined, "canonical row must have wordCount when contentLocation is set");

		const key = articleResourceUniqueId.toS3ContentKey();
		const s3Result = await s3Client.send(
			new GetObjectCommand({ Bucket: bucketName, Key: key }),
		);
		assert(s3Result.Body, "S3 GetObject response must have a Body");
		const html = await s3Result.Body.transformToString("utf-8");

		return {
			html,
			metadata: {
				title: row.title,
				wordCount: row.wordCount,
			},
		};
	};

	return { readCanonicalContent };
}
/* c8 ignore stop */
