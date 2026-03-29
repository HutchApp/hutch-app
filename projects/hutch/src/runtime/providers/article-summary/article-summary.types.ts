export type SummarizeArticle = (params: {
	url: string;
	textContent: string;
}) => Promise<string | null>;

export type FindCachedSummary = (url: string) => Promise<string>;

export type SaveCachedSummary = (params: {
	url: string;
	summary: string;
	inputTokens: number;
	outputTokens: number;
}) => Promise<void>;

export type CreateChatCompletion = (params: {
	model: string;
	max_tokens: number;
	messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
}) => Promise<{
	content: string | null;
	usage: { prompt_tokens: number; completion_tokens: number };
}>;
