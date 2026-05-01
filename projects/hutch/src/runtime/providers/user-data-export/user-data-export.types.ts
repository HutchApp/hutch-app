export interface UploadUserDataExportParams {
	userId: string;
	body: string;
}

export interface UploadUserDataExportResult {
	s3Key: string;
	downloadUrl: string;
}

export type UploadUserDataExport = (
	params: UploadUserDataExportParams,
) => Promise<UploadUserDataExportResult>;
