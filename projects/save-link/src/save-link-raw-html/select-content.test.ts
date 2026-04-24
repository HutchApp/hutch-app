import { noopLogger } from "@packages/hutch-logger";
import {
	initSelectMostCompleteContent,
	type CreateSelectorChatCompletion,
} from "./select-content";
import type { SelectorCandidate } from "./select-content.prompt";

function createCandidates(overrides?: {
	tier0?: Partial<SelectorCandidate>;
	canonical?: Partial<SelectorCandidate>;
}): [SelectorCandidate, SelectorCandidate] {
	return [
		{
			source: "tier-0",
			title: "T0",
			wordCount: 1000,
			html: "<p>tier-0 article body</p>",
			...overrides?.tier0,
		},
		{
			source: "canonical",
			title: "C",
			wordCount: 200,
			html: "<p>verify you are human</p>",
			...overrides?.canonical,
		},
	];
}

function createCompletion(content: string | null | undefined): CreateSelectorChatCompletion {
	return jest.fn().mockResolvedValue({
		choices: [{ message: { content } }],
	});
}

describe("initSelectMostCompleteContent", () => {
	it("returns tier-0 when Deepseek picks A and tier-0 is the A candidate", async () => {
		const createChatCompletion = createCompletion(JSON.stringify({ winner: "A", reason: "more prose" }));
		const { selectMostCompleteContent } = initSelectMostCompleteContent({ createChatCompletion, logger: noopLogger });

		const result = await selectMostCompleteContent({
			url: "https://example.com/article",
			candidates: createCandidates(),
		});

		expect(result).toEqual({ winner: "tier-0", reason: "more prose" });
	});

	it("returns canonical when Deepseek picks B", async () => {
		const createChatCompletion = createCompletion(JSON.stringify({ winner: "B", reason: "tier-0 is anti-bot stub" }));
		const { selectMostCompleteContent } = initSelectMostCompleteContent({ createChatCompletion, logger: noopLogger });

		const result = await selectMostCompleteContent({
			url: "https://example.com/article",
			candidates: createCandidates(),
		});

		expect(result).toEqual({ winner: "canonical", reason: "tier-0 is anti-bot stub" });
	});

	it("returns tie when Deepseek explicitly votes tie", async () => {
		const createChatCompletion = createCompletion(JSON.stringify({ winner: "tie", reason: "comparable" }));
		const { selectMostCompleteContent } = initSelectMostCompleteContent({ createChatCompletion, logger: noopLogger });

		const result = await selectMostCompleteContent({
			url: "https://example.com/article",
			candidates: createCandidates(),
		});

		expect(result).toEqual({ winner: "tie", reason: "comparable" });
	});

	it("returns tie when the response is not parseable JSON", async () => {
		const createChatCompletion = createCompletion("not json at all");
		const { selectMostCompleteContent } = initSelectMostCompleteContent({ createChatCompletion, logger: noopLogger });

		const result = await selectMostCompleteContent({
			url: "https://example.com/article",
			candidates: createCandidates(),
		});

		expect(result.winner).toBe("tie");
	});

	it("returns tie when the JSON does not match the expected schema", async () => {
		const createChatCompletion = createCompletion(JSON.stringify({ winner: "Z", reason: "" }));
		const { selectMostCompleteContent } = initSelectMostCompleteContent({ createChatCompletion, logger: noopLogger });

		const result = await selectMostCompleteContent({
			url: "https://example.com/article",
			candidates: createCandidates(),
		});

		expect(result.winner).toBe("tie");
	});

	it("returns tie when the response is empty", async () => {
		const createChatCompletion = createCompletion("");
		const { selectMostCompleteContent } = initSelectMostCompleteContent({ createChatCompletion, logger: noopLogger });

		const result = await selectMostCompleteContent({
			url: "https://example.com/article",
			candidates: createCandidates(),
		});

		expect(result.winner).toBe("tie");
	});

	it("returns tie when the response is null", async () => {
		const createChatCompletion = createCompletion(null);
		const { selectMostCompleteContent } = initSelectMostCompleteContent({ createChatCompletion, logger: noopLogger });

		const result = await selectMostCompleteContent({
			url: "https://example.com/article",
			candidates: createCandidates(),
		});

		expect(result.winner).toBe("tie");
	});

	it("sends both candidates and the URL in the user message", async () => {
		const createChatCompletion = jest.fn().mockResolvedValue({
			choices: [{ message: { content: JSON.stringify({ winner: "tie", reason: "x" }) } }],
		});
		const { selectMostCompleteContent } = initSelectMostCompleteContent({ createChatCompletion, logger: noopLogger });

		await selectMostCompleteContent({
			url: "https://example.com/article",
			candidates: createCandidates({
				tier0: { html: "<p>FRESH-TIER-0-BODY</p>" },
				canonical: { html: "<p>STALE-CANONICAL-BODY</p>" },
			}),
		});

		expect(createChatCompletion).toHaveBeenCalledTimes(1);
		const call = createChatCompletion.mock.calls[0][0] as Parameters<CreateSelectorChatCompletion>[0];
		expect(call.model).toBe("deepseek-chat");
		expect(call.response_format).toEqual({ type: "json_object" });
		const userContent = call.messages.find((m) => m.role === "user")?.content ?? "";
		expect(userContent).toContain("https://example.com/article");
		expect(userContent).toContain("FRESH-TIER-0-BODY");
		expect(userContent).toContain("STALE-CANONICAL-BODY");
	});
});
