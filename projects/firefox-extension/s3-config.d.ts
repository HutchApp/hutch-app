export const S3_CONFIG: {
	readonly bucketNamePrefix: string;
	readonly region: string;
};

export function getBucketName(stage: string): string;
export function getBucketBaseUrl(stage: string): string;
export function getExtensionDownloadUrl(args: { stage: string; xpiFilename: string }): string;
export function getLatestPointerUrl(stage: string): string;
export function getUpdateManifestUrl(stage: string): string;
