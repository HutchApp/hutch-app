export type SummarizeArticle = (params: {
	url: string;
	textContent: string;
}) => Promise<string | null>;

export type FindCachedSummary = (url: string) => Promise<string | null>;

export type SaveCachedSummary = (params: {
	url: string;
	summary: string;
}) => Promise<void>;
