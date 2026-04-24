/* c8 ignore start -- thin AWS SDK wrapper, tested via integration */
import { CopyObjectCommand } from "@aws-sdk/client-s3";
import type { S3Client } from "@aws-sdk/client-s3";
import {
	type DynamoDBDocumentClient,
	defineDynamoTable,
	dynamoField,
} from "@packages/hutch-storage-client";
import { z } from "zod";
import { ArticleResourceUniqueId } from "../save-link/article-resource-unique-id";
import type { PromoteSourceToCanonical } from "./promote-source.types";

const ArticleRow = z.object({
	title: dynamoField(z.string()),
	siteName: dynamoField(z.string()),
	excerpt: dynamoField(z.string()),
	wordCount: dynamoField(z.number()),
	estimatedReadTime: dynamoField(z.number()),
	imageUrl: dynamoField(z.string()),
	contentLocation: dynamoField(z.string()),
	contentFetchedAt: dynamoField(z.string()),
});

export function initPromoteSourceToCanonical(deps: {
	dynamoClient: DynamoDBDocumentClient;
	s3Client: S3Client;
	tableName: string;
	bucketName: string;
	now: () => Date;
}): { promoteSourceToCanonical: PromoteSourceToCanonical } {
	const { dynamoClient, s3Client, tableName, bucketName, now } = deps;

	const articleTable = defineDynamoTable({
		client: dynamoClient,
		tableName,
		schema: ArticleRow,
	});

	const promoteSourceToCanonical: PromoteSourceToCanonical = async (params) => {
		const articleResourceUniqueId = ArticleResourceUniqueId.parse(params.url);
		const sourceKey = articleResourceUniqueId.toS3SourceKey({ tier: params.tier });
		const canonicalKey = articleResourceUniqueId.toS3ContentKey();

		await s3Client.send(
			new CopyObjectCommand({
				Bucket: bucketName,
				Key: canonicalKey,
				CopySource: `${bucketName}/${encodeURIComponent(sourceKey)}`,
				ContentType: "text/html; charset=utf-8",
				MetadataDirective: "REPLACE",
			}),
		);

		const setClauses = [
			"title = :t",
			"siteName = :s",
			"excerpt = :e",
			"wordCount = :w",
			"estimatedReadTime = :r",
			"contentLocation = :cl",
			"contentFetchedAt = :cfa",
		];
		const values: Record<string, unknown> = {
			":t": params.metadata.title,
			":s": params.metadata.siteName,
			":e": params.metadata.excerpt,
			":w": params.metadata.wordCount,
			":r": params.metadata.estimatedReadTime,
			":cl": `s3://${bucketName}/${canonicalKey}`,
			":cfa": now().toISOString(),
		};
		if (params.metadata.imageUrl) {
			setClauses.push("imageUrl = :img");
			values[":img"] = params.metadata.imageUrl;
		}

		await articleTable.update({
			Key: { url: articleResourceUniqueId.value },
			UpdateExpression: `SET ${setClauses.join(", ")}`,
			ExpressionAttributeValues: values,
		});
	};

	return { promoteSourceToCanonical };
}
/* c8 ignore stop */
