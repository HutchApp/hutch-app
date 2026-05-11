import { initInMemoryEffectDispatcher } from "./in-memory-effect-dispatcher";

describe("initInMemoryEffectDispatcher", () => {
	it("records each batch the orchestrator dispatches in order", async () => {
		const dispatcher = initInMemoryEffectDispatcher();
		await dispatcher.dispatch([
			{ kind: "DispatchGenerateSummaryCommand", url: "https://a/" },
		]);
		await dispatcher.dispatch([
			{ kind: "PublishRecrawlLinkInitiatedEvent", url: "https://b/" },
		]);

		expect(dispatcher.batches).toEqual([
			[{ kind: "DispatchGenerateSummaryCommand", url: "https://a/" }],
			[{ kind: "PublishRecrawlLinkInitiatedEvent", url: "https://b/" }],
		]);
	});

	it("flat() returns every effect across every batch in dispatch order", async () => {
		const dispatcher = initInMemoryEffectDispatcher();
		await dispatcher.dispatch([
			{ kind: "DispatchGenerateSummaryCommand", url: "https://a/" },
			{ kind: "PublishRecrawlLinkInitiatedEvent", url: "https://a/" },
		]);
		await dispatcher.dispatch([
			{ kind: "DispatchGenerateSummaryCommand", url: "https://b/" },
		]);

		expect(dispatcher.flat()).toEqual([
			{ kind: "DispatchGenerateSummaryCommand", url: "https://a/" },
			{ kind: "PublishRecrawlLinkInitiatedEvent", url: "https://a/" },
			{ kind: "DispatchGenerateSummaryCommand", url: "https://b/" },
		]);
	});

	it("failNext rejects the next call AND does not record the batch", async () => {
		// The all-or-nothing contract: a failed dispatch surfaces to the
		// orchestrator (so SQS retries the whole handler invocation) and the
		// fake mirrors production by NOT persisting the partial batch.
		const dispatcher = initInMemoryEffectDispatcher();
		dispatcher.failNext();

		await expect(
			dispatcher.dispatch([
				{ kind: "DispatchGenerateSummaryCommand", url: "https://a/" },
			]),
		).rejects.toThrow();
		expect(dispatcher.batches).toEqual([]);
	});

	it("failNext is a one-shot — subsequent calls succeed", async () => {
		const dispatcher = initInMemoryEffectDispatcher();
		dispatcher.failNext();

		await expect(dispatcher.dispatch([])).rejects.toThrow();
		await dispatcher.dispatch([
			{ kind: "DispatchGenerateSummaryCommand", url: "https://a/" },
		]);

		expect(dispatcher.flat()).toEqual([
			{ kind: "DispatchGenerateSummaryCommand", url: "https://a/" },
		]);
	});

	it("failNext surfaces the supplied error so the orchestrator can distinguish it", async () => {
		const dispatcher = initInMemoryEffectDispatcher();
		const expected = new Error("EventBridge throttling");
		dispatcher.failNext(expected);

		await expect(dispatcher.dispatch([])).rejects.toBe(expected);
	});
});
