export const S3_CONFIG: {
	readonly bucketNamePrefix: string;
	readonly region: string;
};

export function getBucketName(stage: string): string;
export function getBucketBaseUrl(stage: string): string;
export function getExtensionDownloadUrl(stage: string, crxFilename: string): string;
export function getLatestPointerUrl(stage: string): string;
