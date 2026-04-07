import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { consoleLogger } from "@packages/hutch-logger";
import { EventBridgeClient, initEventBridgePublisher } from "@packages/hutch-infra-components/runtime";
import { LinkSavedEvent } from "@packages/hutch-infra-components";
import { requireEnv } from "../require-env";
import { initFindArticleContent } from "../save-link/find-article-content";
import { initS3PutObject } from "../save-link/s3-put-object";
import { initUpdateContentLocation } from "../save-link/update-content-location";
import { initSaveLinkCommandHandler } from "../save-link/save-link-command-handler";

const articlesTable = requireEnv("DYNAMODB_ARTICLES_TABLE");
const contentBucketName = requireEnv("CONTENT_BUCKET_NAME");
const eventBusName = requireEnv("EVENT_BUS_NAME");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3Client = new S3Client({});

const { findArticleContent } = initFindArticleContent({
	client,
	tableName: articlesTable,
});

const { putObject } = initS3PutObject({
	client: s3Client,
	bucketName: contentBucketName,
});

const { updateContentLocation } = initUpdateContentLocation({
	client,
	tableName: articlesTable,
});

const { publishEvent } = initEventBridgePublisher({
	client: new EventBridgeClient({}),
	eventBusName,
});

const publishLinkSaved = async (params: { url: string; userId: string }) => {
	await publishEvent({
		source: LinkSavedEvent.source,
		detailType: LinkSavedEvent.detailType,
		detail: JSON.stringify({ url: params.url, userId: params.userId }),
	});
};

export const handler = initSaveLinkCommandHandler({
	findArticleContent,
	putObject,
	updateContentLocation,
	publishLinkSaved,
	logger: consoleLogger,
});
