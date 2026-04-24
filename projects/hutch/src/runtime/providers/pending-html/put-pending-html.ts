/* c8 ignore start -- thin AWS SDK wrapper, tested via integration */
import { PutObjectCommand } from "@aws-sdk/client-s3";
import type { S3Client } from "@aws-sdk/client-s3";
import { ArticleResourceUniqueId } from "@packages/article-resource-unique-id";
import type { PutPendingHtml } from "./pending-html.types";

export function initPutPendingHtml(deps: {
	client: S3Client;
	bucketName: string;
}): { putPendingHtml: PutPendingHtml } {
	const { client, bucketName } = deps;

	const putPendingHtml: PutPendingHtml = async (params) => {
		const key = ArticleResourceUniqueId.parse(params.url).toS3PendingHtmlKey();
		await client.send(
			new PutObjectCommand({
				Bucket: bucketName,
				Key: key,
				Body: params.html,
				ContentType: "text/html; charset=utf-8",
			}),
		);
	};

	return { putPendingHtml };
}
/* c8 ignore stop */
