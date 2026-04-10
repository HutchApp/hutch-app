export type PublishUpdateFetchTimestamp = (params: {
	url: string;
	contentFetchedAt: string;
}) => Promise<void>;
