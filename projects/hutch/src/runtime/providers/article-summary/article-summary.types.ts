export type SummarizeArticle = (params: {
	url: string;
	textContent: string;
}) => Promise<string | null>;

export type FindCachedSummary = (url: string) => Promise<string | null>;

export type SaveCachedSummary = (params: {
	url: string;
	summary: string;
}) => Promise<void>;

export type CreateAiMessage = (params: {
	model: string;
	max_tokens: number;
	system: string;
	messages: Array<{ role: "user" | "assistant"; content: string }>;
}) => Promise<{
	content: Array<{ type: string; text?: string }>;
}>;
