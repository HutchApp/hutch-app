/**
 * S3 configuration for the Firefox extension deployment.
 * Used by both:
 * - infra/index.ts (Pulumi infrastructure)
 * - hutch web app install page
 */

const S3_CONFIG = {
	bucketNamePrefix: "hutch-extension",
	region: "ap-southeast-2",
};

function getBucketName(stage) {
	return `${S3_CONFIG.bucketNamePrefix}-${stage}`;
}

function getBucketBaseUrl(stage) {
	const bucketName = getBucketName(stage);
	return `https://${bucketName}.s3.${S3_CONFIG.region}.amazonaws.com`;
}

function getExtensionDownloadUrl({ stage, xpiFilename }) {
	return `${getBucketBaseUrl(stage)}/${xpiFilename}`;
}

function getLatestPointerUrl(stage) {
	return `${getBucketBaseUrl(stage)}/latest.txt`;
}

function getUpdateManifestUrl(stage) {
	return `${getBucketBaseUrl(stage)}/updates.json`;
}

module.exports = { S3_CONFIG, getBucketName, getBucketBaseUrl, getExtensionDownloadUrl, getLatestPointerUrl, getUpdateManifestUrl };
