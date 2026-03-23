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

export type CreateAiMessage = (params: {
	model: string;
	max_tokens: number;
	system: string;
	messages: Array<{ role: "user" | "assistant"; content: string }>;
	output_config?: {
		format: {
			type: "json_schema";
			schema: Record<string, unknown>;
		};
	};
}) => Promise<{
	content: Array<{ type: string; text?: string }>;
	usage: { input_tokens: number; output_tokens: number };
}>;
