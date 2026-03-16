/**
 * S3 configuration for the Chrome extension deployment.
 * Used by both:
 * - infra/index.ts (Pulumi infrastructure)
 * - hutch web app install page
 */

const S3_CONFIG = {
	bucketNamePrefix: "hutch-chrome-extension",
	region: "ap-southeast-2",
};

function getBucketName(stage) {
	return `${S3_CONFIG.bucketNamePrefix}-${stage}`;
}

function getBucketBaseUrl(stage) {
	const bucketName = getBucketName(stage);
	return `https://${bucketName}.s3.${S3_CONFIG.region}.amazonaws.com`;
}

function getExtensionDownloadUrl(stage, crxFilename) {
	return `${getBucketBaseUrl(stage)}/${crxFilename}`;
}

function getLatestPointerUrl(stage) {
	return `${getBucketBaseUrl(stage)}/latest.txt`;
}

module.exports = { S3_CONFIG, getBucketName, getBucketBaseUrl, getExtensionDownloadUrl, getLatestPointerUrl };
