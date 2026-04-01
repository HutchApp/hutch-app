import { noopLogger } from "@packages/hutch-logger";
import { initCreateMessageWithFallback } from "./create-message-with-fallback";
import type { CreateAiMessage } from "./article-summary.types";

const messageParams: Parameters<CreateAiMessage>[0] = {
	model: "test-model",
	max_tokens: 100,
	system: "You are a test assistant.",
	messages: [{ role: "user", content: "Hello" }],
};

const primaryResult: Awaited<ReturnType<CreateAiMessage>> = {
	content: [{ type: "text", text: "primary response" }],
	usage: { input_tokens: 10, output_tokens: 5 },
};

const fallbackResult: Awaited<ReturnType<CreateAiMessage>> = {
	content: [{ type: "text", text: "fallback response" }],
	usage: { input_tokens: 20, output_tokens: 8 },
};

describe("initCreateMessageWithFallback", () => {
	it("should log primary start/end and return primary result when primary succeeds", async () => {
		const primary = jest.fn<ReturnType<CreateAiMessage>, Parameters<CreateAiMessage>>().mockResolvedValue(primaryResult);
		const fallback = jest.fn<ReturnType<CreateAiMessage>, Parameters<CreateAiMessage>>();
		const logger = { ...noopLogger, info: jest.fn() };

		const createMessage = initCreateMessageWithFallback({
			primary,
			fallback,
			shouldFallback: () => false,
			logger,
		});

		const result = await createMessage(messageParams);

		expect(result).toEqual(primaryResult);
		expect(fallback).not.toHaveBeenCalled();
		expect(logger.info).toHaveBeenCalledWith("[summarize] primary AI starting");
		expect(logger.info).toHaveBeenCalledWith("[summarize] primary AI completed");
	});

	it("should log primary start, error, fallback start/end when falling back", async () => {
		const apiError = new Error("overloaded");
		const primary = jest.fn<ReturnType<CreateAiMessage>, Parameters<CreateAiMessage>>().mockRejectedValue(apiError);
		const fallback = jest.fn<ReturnType<CreateAiMessage>, Parameters<CreateAiMessage>>().mockResolvedValue(fallbackResult);
		const logger = { ...noopLogger, info: jest.fn() };

		const createMessage = initCreateMessageWithFallback({
			primary,
			fallback,
			shouldFallback: () => true,
			logger,
		});

		const result = await createMessage(messageParams);

		expect(result).toEqual(fallbackResult);
		expect(fallback).toHaveBeenCalledWith(messageParams);
		expect(logger.info).toHaveBeenCalledWith("[summarize] primary AI starting");
		expect(logger.info).toHaveBeenCalledWith("[summarize] primary AI error, falling back", apiError);
		expect(logger.info).toHaveBeenCalledWith("[summarize] fallback AI starting");
		expect(logger.info).toHaveBeenCalledWith("[summarize] fallback AI completed");
	});

	it("should propagate errors when shouldFallback returns false", async () => {
		const otherError = new Error("network failure");
		const primary = jest.fn<ReturnType<CreateAiMessage>, Parameters<CreateAiMessage>>().mockRejectedValue(otherError);
		const fallback = jest.fn<ReturnType<CreateAiMessage>, Parameters<CreateAiMessage>>();

		const createMessage = initCreateMessageWithFallback({
			primary,
			fallback,
			shouldFallback: () => false,
			logger: noopLogger,
		});

		await expect(createMessage(messageParams)).rejects.toThrow("network failure");
		expect(fallback).not.toHaveBeenCalled();
	});

	it("should propagate fallback errors when fallback also throws", async () => {
		const apiError = new Error("rate limited");
		const fallbackError = new Error("fallback also failed");
		const primary = jest.fn<ReturnType<CreateAiMessage>, Parameters<CreateAiMessage>>().mockRejectedValue(apiError);
		const fallback = jest.fn<ReturnType<CreateAiMessage>, Parameters<CreateAiMessage>>().mockRejectedValue(fallbackError);

		const createMessage = initCreateMessageWithFallback({
			primary,
			fallback,
			shouldFallback: (error: unknown) => error === apiError,
			logger: noopLogger,
		});

		await expect(createMessage(messageParams)).rejects.toThrow("fallback also failed");
	});
});
