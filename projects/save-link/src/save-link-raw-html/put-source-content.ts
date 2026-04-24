/* c8 ignore start -- thin AWS SDK wrapper, tested via integration */
import { PutObjectCommand } from "@aws-sdk/client-s3";
import type { S3Client } from "@aws-sdk/client-s3";
import { ArticleResourceUniqueId } from "../save-link/article-resource-unique-id";
import type { PutSourceContent } from "./source-content.types";

export function initPutSourceContent(deps: {
	client: S3Client;
	bucketName: string;
}): { putSourceContent: PutSourceContent } {
	const { client, bucketName } = deps;

	const putSourceContent: PutSourceContent = async (params) => {
		const key = ArticleResourceUniqueId.parse(params.url).toS3SourceKey({ tier: params.tier });
		await client.send(
			new PutObjectCommand({
				Bucket: bucketName,
				Key: key,
				Body: params.html,
				ContentType: "text/html; charset=utf-8",
			}),
		);
	};

	return { putSourceContent };
}
/* c8 ignore stop */
