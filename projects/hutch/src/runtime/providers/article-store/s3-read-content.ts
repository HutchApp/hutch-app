/* c8 ignore start -- thin AWS SDK wrapper */
import type { S3Client } from "@aws-sdk/client-s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import assert from "node:assert";
import type { ArticleResourceUniqueId } from "@packages/article-resource-unique-id";
import type { ContentProvider } from "./read-article-content";

function contentS3Key(articleResourceUniqueId: ArticleResourceUniqueId): string {
	return `content/${encodeURIComponent(articleResourceUniqueId.value)}/content.html`;
}

export function initS3ReadContent(deps: {
	client: S3Client;
	bucketName: string;
}): ContentProvider {
	const { client, bucketName } = deps;

	return async (articleResourceUniqueId) => {
		const key = contentS3Key(articleResourceUniqueId);
		const result = await client.send(
			new GetObjectCommand({ Bucket: bucketName, Key: key }),
		);
		assert(result.Body, "S3 GetObject response must have a Body");
		return await result.Body.transformToString("utf-8");
	};
}
/* c8 ignore stop */
