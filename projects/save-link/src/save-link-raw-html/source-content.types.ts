export type PutSourceContent = (params: {
	url: string;
	tier: string;
	html: string;
}) => Promise<void>;
