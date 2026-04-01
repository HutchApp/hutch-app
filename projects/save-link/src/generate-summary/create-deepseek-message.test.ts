import { initCreateDeepseekMessage } from "./create-deepseek-message";

describe("initCreateDeepseekMessage", () => {
	it("should prepend system message and map response to CreateAiMessage format", async () => {
		const createChatCompletion = jest.fn().mockResolvedValue({
			choices: [{ message: { content: "Article explains quantum computing basics" } }],
			usage: { prompt_tokens: 50, completion_tokens: 20 },
		});

		const createMessage = initCreateDeepseekMessage({ createChatCompletion });
		const result = await createMessage({
			model: "ignored-model",
			max_tokens: 1024,
			system: "You are a summarizer.",
			messages: [{ role: "user", content: "Summarize this article" }],
		});

		expect(createChatCompletion).toHaveBeenCalledWith({
			model: "deepseek-chat",
			max_tokens: 1024,
			messages: [
				{ role: "system", content: "You are a summarizer." },
				{ role: "user", content: "Summarize this article" },
			],
		});
		expect(result).toEqual({
			content: [{ type: "text", text: JSON.stringify({ summary: "Article explains quantum computing basics" }) }],
			usage: { input_tokens: 50, output_tokens: 20 },
		});
	});

	it("should trim whitespace from response content", async () => {
		const createChatCompletion = jest.fn().mockResolvedValue({
			choices: [{ message: { content: "  trimmed text  \n" } }],
			usage: { prompt_tokens: 5, completion_tokens: 3 },
		});

		const createMessage = initCreateDeepseekMessage({ createChatCompletion });
		const result = await createMessage({
			model: "any",
			max_tokens: 100,
			system: "system",
			messages: [{ role: "user", content: "hello" }],
		});

		expect(result.content[0].text).toBe(JSON.stringify({ summary: "trimmed text" }));
	});

	it("should throw when response has no message content", async () => {
		const createChatCompletion = jest.fn().mockResolvedValue({
			choices: [{ message: { content: null } }],
			usage: { prompt_tokens: 10, completion_tokens: 0 },
		});

		const createMessage = initCreateDeepseekMessage({ createChatCompletion });

		await expect(createMessage({
			model: "any",
			max_tokens: 100,
			system: "system",
			messages: [{ role: "user", content: "hello" }],
		})).rejects.toThrow("DeepSeek response missing message content");
	});

	it("should cap max_tokens to 8192", async () => {
		const createChatCompletion = jest.fn().mockResolvedValue({
			choices: [{ message: { content: "summary" } }],
			usage: { prompt_tokens: 10, completion_tokens: 5 },
		});

		const createMessage = initCreateDeepseekMessage({ createChatCompletion });
		await createMessage({
			model: "any",
			max_tokens: 10240,
			system: "system",
			messages: [{ role: "user", content: "hello" }],
		});

		expect(createChatCompletion).toHaveBeenCalledWith(
			expect.objectContaining({ max_tokens: 8192 }),
		);
	});

	it("should throw when response has no usage data", async () => {
		const createChatCompletion = jest.fn().mockResolvedValue({
			choices: [{ message: { content: "some text" } }],
			usage: null,
		});

		const createMessage = initCreateDeepseekMessage({ createChatCompletion });

		await expect(createMessage({
			model: "any",
			max_tokens: 100,
			system: "system",
			messages: [{ role: "user", content: "hello" }],
		})).rejects.toThrow("DeepSeek response missing usage data");
	});
});
