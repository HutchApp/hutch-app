export type PublishSaveLinkRawHtmlCommand = (params: {
	url: string;
	userId: string;
	title?: string;
}) => Promise<void>;
