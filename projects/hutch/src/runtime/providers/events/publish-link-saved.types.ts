export type PublishLinkSaved = (params: {
	url: string;
	userId: string;
}) => Promise<void>;
