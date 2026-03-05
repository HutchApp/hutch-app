export const S3_CONFIG: {
	readonly bucketNamePrefix: string;
	readonly key: string;
	readonly region: string;
};

export function getBucketName(stage: string): string;
export function getExtensionDownloadUrl(stage: string): string;
