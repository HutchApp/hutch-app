import assert from "node:assert";
import type { CreateAiMessage } from "./article-summary.types";

type ChatCompletionResponse = {
	choices: Array<{ message?: { content?: string | null } }>;
	usage?: { prompt_tokens: number; completion_tokens: number } | null;
};

export type CreateChatCompletion = (params: {
	model: string;
	max_tokens: number;
	messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
}) => Promise<ChatCompletionResponse>;

// DeepSeek does not support output_config (structured output), so the adapter
// ignores it and wraps the plain-text response in JSON to match the schema
// expected by the consumer (link-summariser parses JSON with { summary: string }).
export function initCreateDeepseekMessage(deps: {
	createChatCompletion: CreateChatCompletion;
}): CreateAiMessage {
	return async (params) => {
		const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
			{ role: "system", content: params.system },
			...params.messages,
		];
		const response = await deps.createChatCompletion({
			model: "deepseek-chat",
			max_tokens: params.max_tokens,
			messages,
		});
		const text = response.choices[0]?.message?.content?.trim();
		assert(text, "DeepSeek response missing message content");
		assert(response.usage, "DeepSeek response missing usage data");
		return {
			content: [{ type: "text", text: JSON.stringify({ summary: text }) }],
			usage: {
				input_tokens: response.usage.prompt_tokens,
				output_tokens: response.usage.completion_tokens,
			},
		};
	};
}
