export type PublishExportUserDataCommand = (params: {
	userId: string;
	email: string;
	requestedAt: string;
}) => Promise<void>;
