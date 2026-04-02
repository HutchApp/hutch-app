export type FindCachedSummary = (url: string) => Promise<string>;

export type SaveCachedSummary = (params: {
	url: string;
	summary: string;
	inputTokens: number;
	outputTokens: number;
}) => Promise<void>;
