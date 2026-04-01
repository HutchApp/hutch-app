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
	it("should return primary result when primary succeeds", async () => {
		const primary = jest.fn<ReturnType<CreateAiMessage>, Parameters<CreateAiMessage>>().mockResolvedValue(primaryResult);
		const fallback = jest.fn<ReturnType<CreateAiMessage>, Parameters<CreateAiMessage>>();

		const createMessage = initCreateMessageWithFallback({
			primary,
			fallback,
			isQuotaError: () => false,
			logger: noopLogger,
		});

		const result = await createMessage(messageParams);

		expect(result).toEqual(primaryResult);
		expect(fallback).not.toHaveBeenCalled();
	});

	it("should call fallback when primary throws a quota error", async () => {
		const quotaError = new Error("rate limited");
		const primary = jest.fn<ReturnType<CreateAiMessage>, Parameters<CreateAiMessage>>().mockRejectedValue(quotaError);
		const fallback = jest.fn<ReturnType<CreateAiMessage>, Parameters<CreateAiMessage>>().mockResolvedValue(fallbackResult);

		const createMessage = initCreateMessageWithFallback({
			primary,
			fallback,
			isQuotaError: (error) => error === quotaError,
			logger: noopLogger,
		});

		const result = await createMessage(messageParams);

		expect(result).toEqual(fallbackResult);
		expect(fallback).toHaveBeenCalledWith(messageParams);
	});

	it("should propagate non-quota errors without calling fallback", async () => {
		const otherError = new Error("network failure");
		const primary = jest.fn<ReturnType<CreateAiMessage>, Parameters<CreateAiMessage>>().mockRejectedValue(otherError);
		const fallback = jest.fn<ReturnType<CreateAiMessage>, Parameters<CreateAiMessage>>();

		const createMessage = initCreateMessageWithFallback({
			primary,
			fallback,
			isQuotaError: () => false,
			logger: noopLogger,
		});

		await expect(createMessage(messageParams)).rejects.toThrow("network failure");
		expect(fallback).not.toHaveBeenCalled();
	});

	it("should propagate fallback errors when fallback also throws", async () => {
		const quotaError = new Error("rate limited");
		const fallbackError = new Error("fallback also failed");
		const primary = jest.fn<ReturnType<CreateAiMessage>, Parameters<CreateAiMessage>>().mockRejectedValue(quotaError);
		const fallback = jest.fn<ReturnType<CreateAiMessage>, Parameters<CreateAiMessage>>().mockRejectedValue(fallbackError);

		const createMessage = initCreateMessageWithFallback({
			primary,
			fallback,
			isQuotaError: (error) => error === quotaError,
			logger: noopLogger,
		});

		await expect(createMessage(messageParams)).rejects.toThrow("fallback also failed");
	});
});
