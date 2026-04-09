/* c8 ignore start -- thin AWS SDK wrapper */
import type { S3Client } from "@aws-sdk/client-s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import assert from "node:assert";
import type { ArticleUniqueId } from "@packages/article-unique-id";
import type { ContentProvider } from "./read-article-content";

function contentS3Key(articleUniqueId: ArticleUniqueId): string {
	return `content/${encodeURIComponent(articleUniqueId.value)}/content.html`;
}

export function initS3ReadContent(deps: {
	client: S3Client;
	bucketName: string;
}): ContentProvider {
	const { client, bucketName } = deps;

	return async (articleUniqueId) => {
		const key = contentS3Key(articleUniqueId);
		const result = await client.send(
			new GetObjectCommand({ Bucket: bucketName, Key: key }),
		);
		assert(result.Body, "S3 GetObject response must have a Body");
		return await result.Body.transformToString("utf-8");
	};
}
/* c8 ignore stop */
