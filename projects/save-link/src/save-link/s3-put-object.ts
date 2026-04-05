/* c8 ignore start -- thin AWS SDK wrapper, tested via integration */
import { PutObjectCommand } from "@aws-sdk/client-s3";
import type { S3Client } from "@aws-sdk/client-s3";
import type { PutObject } from "./save-link-command-handler";

export function initS3PutObject(deps: {
	client: S3Client;
	bucketName: string;
}): { putObject: PutObject } {
	const { client, bucketName } = deps;

	const putObject: PutObject = async (params) => {
		await client.send(
			new PutObjectCommand({
				Bucket: bucketName,
				Key: params.key,
				Body: params.content,
				ContentType: "text/html; charset=utf-8",
			}),
		);
		return `s3://${bucketName}/${params.key}`;
	};

	return { putObject };
}
/* c8 ignore stop */
