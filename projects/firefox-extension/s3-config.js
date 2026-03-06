/**
 * S3 configuration for the Firefox extension deployment.
 * Used by both:
 * - infra/index.ts (Pulumi infrastructure)
 * - hutch web app install page
 */

const S3_CONFIG = {
	bucketNamePrefix: "hutch-extension",
	key: "hutch.xpi",
	region: "ap-southeast-2",
};

function getBucketName(stage) {
	return `${S3_CONFIG.bucketNamePrefix}-${stage}`;
}

function getExtensionDownloadUrl(stage) {
	const bucketName = getBucketName(stage);
	return `https://${bucketName}.s3.${S3_CONFIG.region}.amazonaws.com/${S3_CONFIG.key}`;
}

module.exports = { S3_CONFIG, getBucketName, getExtensionDownloadUrl };
