export type SummarizeArticle = (params: {
	url: string;
	textContent: string;
}) => Promise<{ summary: string; inputTokens: number; outputTokens: number } | null>;

export type FindCachedSummary = (url: string) => Promise<string>;

export type SaveCachedSummary = (params: {
	url: string;
	summary: string;
	inputTokens: number;
	outputTokens: number;
}) => Promise<void>;

export type DocumentBlock = {
	type: "document";
	source: { type: "text"; media_type: "text/plain"; data: string };
	title: string;
	citations: { enabled: boolean };
};

export type CreateAiMessage = (params: {
	model: string;
	max_tokens: number;
	system: string;
	messages: Array<{ role: "user" | "assistant"; content: string | Array<DocumentBlock> }>;
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
