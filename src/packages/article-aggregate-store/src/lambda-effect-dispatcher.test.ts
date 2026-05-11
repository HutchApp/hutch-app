import { RecrawlLinkInitiatedEvent } from "@packages/hutch-infra-components";
import { initLambdaEffectDispatcher } from "./lambda-effect-dispatcher";

describe("initLambdaEffectDispatcher", () => {
	it("translates DispatchGenerateSummaryCommand into a single dispatchGenerateSummary call", async () => {
		const publishedEvents: unknown[] = [];
		const dispatchedCommands: unknown[] = [];
		const dispatch = initLambdaEffectDispatcher({
			publishEvent: async (p) => {
				publishedEvents.push(p);
			},
			dispatchGenerateSummary: async (d) => {
				dispatchedCommands.push(d);
			},
		});

		await dispatch([
			{ kind: "DispatchGenerateSummaryCommand", url: "https://a/" },
		]);

		expect(dispatchedCommands).toEqual([{ url: "https://a/" }]);
		expect(publishedEvents).toEqual([]);
	});

	it("translates PublishRecrawlLinkInitiatedEvent into a publishEvent call with the registered source+detailType", async () => {
		const publishedEvents: {
			source: string;
			detailType: string;
			detail: string;
		}[] = [];
		const dispatch = initLambdaEffectDispatcher({
			publishEvent: async (p) => {
				publishedEvents.push(p);
			},
			dispatchGenerateSummary: async () => {},
		});

		await dispatch([
			{ kind: "PublishRecrawlLinkInitiatedEvent", url: "https://a/" },
		]);

		expect(publishedEvents).toHaveLength(1);
		expect(publishedEvents[0]?.source).toBe(RecrawlLinkInitiatedEvent.source);
		expect(publishedEvents[0]?.detailType).toBe(
			RecrawlLinkInitiatedEvent.detailType,
		);
		expect(JSON.parse(publishedEvents[0]?.detail ?? "{}")).toEqual({
			url: "https://a/",
		});
	});

	it("dispatches multiple effects sequentially in input order", async () => {
		const calls: string[] = [];
		const dispatch = initLambdaEffectDispatcher({
			publishEvent: async () => {
				calls.push("publish");
			},
			dispatchGenerateSummary: async () => {
				calls.push("dispatch");
			},
		});

		await dispatch([
			{ kind: "PublishRecrawlLinkInitiatedEvent", url: "https://a/" },
			{ kind: "DispatchGenerateSummaryCommand", url: "https://a/" },
		]);

		expect(calls).toEqual(["publish", "dispatch"]);
	});

	it("throws if any effect's adapter throws — surfaces the SQS-retry signal", async () => {
		// The contract that closes class #2: an effect-dispatch failure
		// propagates to the orchestrator, which propagates to the handler,
		// which is what keeps the SQS message in flight for redelivery.
		const dispatch = initLambdaEffectDispatcher({
			publishEvent: async () => {},
			dispatchGenerateSummary: async () => {
				throw new Error("SQS throttled");
			},
		});

		await expect(
			dispatch([
				{ kind: "DispatchGenerateSummaryCommand", url: "https://a/" },
			]),
		).rejects.toThrow("SQS throttled");
	});
});
