import assert from "node:assert/strict";
import type { Article } from "./aggregate.types";
import type { Minutes } from "./article.types";
import type { DispatchEffects, Effect } from "./effect.types";
import { initTransitionAndPersist } from "./transition-and-persist";
import { refreshContent } from "./transitions/refresh-content";
import { requestRecrawl } from "./transitions/request-recrawl";
import type { ArticleStore, SaveArticleParams } from "./storage.types";
import { AggregateConcurrencyError } from "./storage.types";

function buildArticle(overrides: Partial<Article> = {}): Article {
	return {
		url: "https://example.com/article",
		version: 1,
		crawl: { status: "ready" },
		summary: {
			status: "ready",
			summary: "old",
			excerpt: "old",
			inputTokens: 1,
			outputTokens: 1,
		},
		metadata: {
			title: "T",
			siteName: "example.com",
			excerpt: "E",
			wordCount: 1,
		},
		estimatedReadTime: 1 as Minutes,
		...overrides,
	};
}

interface FakeStoreCallLog {
	loads: string[];
	saves: SaveArticleParams[];
}

function initFakeStore(initial: Article): {
	store: ArticleStore;
	log: FakeStoreCallLog;
	mutateOnLoad: (mutator: () => void) => void;
	failNextSavesWithConflict: (n: number) => void;
} {
	let current: Article = initial;
	const log: FakeStoreCallLog = { loads: [], saves: [] };
	let conflictBudget = 0;
	let onLoadHook: (() => void) | undefined;

	const store: ArticleStore = {
		load: async (url) => {
			log.loads.push(url);
			if (onLoadHook) {
				const hook = onLoadHook;
				onLoadHook = undefined;
				hook();
			}
			return current.url === url ? current : undefined;
		},
		save: async ({ article, expectedVersion }) => {
			log.saves.push({ article, expectedVersion });
			if (conflictBudget > 0) {
				conflictBudget -= 1;
				current = { ...current, version: current.version + 1 };
				throw new AggregateConcurrencyError({
					url: article.url,
					expectedVersion,
				});
			}
			if (current.version !== expectedVersion) {
				throw new AggregateConcurrencyError({
					url: article.url,
					expectedVersion,
				});
			}
			current = { ...article, version: expectedVersion + 1 };
		},
	};

	return {
		store,
		log,
		mutateOnLoad: (mutator) => {
			onLoadHook = mutator;
		},
		failNextSavesWithConflict: (n: number) => {
			conflictBudget = n;
		},
	};
}

function initFakeDispatcher(): {
	dispatcher: DispatchEffects;
	dispatched: Effect[][];
	failOnce: () => void;
} {
	const dispatched: Effect[][] = [];
	let failNext = false;
	return {
		dispatcher: async (effects) => {
			if (failNext) {
				failNext = false;
				throw new Error("dispatcher exploded");
			}
			dispatched.push([...effects]);
		},
		dispatched,
		failOnce: () => {
			failNext = true;
		},
	};
}

describe("transitionAndPersist", () => {
	const refreshParams = {
		metadata: {
			title: "new",
			siteName: "example.com",
			excerpt: "new",
			wordCount: 2,
		},
		estimatedReadTime: 2 as Minutes,
		contentFetchedAt: "2026-05-11T00:00:00Z",
	};

	it("loads, applies transition, saves at expectedVersion=loaded version, then dispatches effects", async () => {
		const initial = buildArticle({ version: 7 });
		const { store, log } = initFakeStore(initial);
		const { dispatcher, dispatched } = initFakeDispatcher();
		const transitionAndPersist = initTransitionAndPersist({ store, dispatcher });

		await transitionAndPersist({
			url: initial.url,
			transition: refreshContent,
			params: refreshParams,
		});

		expect(log.loads).toEqual([initial.url]);
		assert.equal(log.saves.length, 1);
		expect(log.saves[0]?.expectedVersion).toBe(7);
		expect(log.saves[0]?.article.summary).toEqual({ status: "pending" });
		expect(dispatched).toEqual([
			[{ kind: "DispatchGenerateSummaryCommand", url: initial.url }],
		]);
	});

	it("dispatches AFTER save so a failed save never produces a phantom event", async () => {
		const initial = buildArticle({ version: 3 });
		const { store } = initFakeStore(initial);
		const callOrder: string[] = [];
		const wrappedStore: ArticleStore = {
			load: async (u) => {
				callOrder.push("load");
				return store.load(u);
			},
			save: async (p) => {
				callOrder.push("save");
				return store.save(p);
			},
		};
		const dispatcher: DispatchEffects = async () => {
			callOrder.push("dispatch");
		};
		const transitionAndPersist = initTransitionAndPersist({
			store: wrappedStore,
			dispatcher,
		});

		await transitionAndPersist({
			url: initial.url,
			transition: refreshContent,
			params: refreshParams,
		});

		expect(callOrder).toEqual(["load", "save", "dispatch"]);
	});

	it("throws and does NOT dispatch when the storage save fails permanently", async () => {
		const initial = buildArticle({ version: 1 });
		const { store, failNextSavesWithConflict } = initFakeStore(initial);
		const { dispatcher, dispatched } = initFakeDispatcher();
		failNextSavesWithConflict(10); // exceeds retry budget
		const transitionAndPersist = initTransitionAndPersist({
			store,
			dispatcher,
			retryBudget: 1,
		});

		await expect(
			transitionAndPersist({
				url: initial.url,
				transition: refreshContent,
				params: refreshParams,
			}),
		).rejects.toBeInstanceOf(AggregateConcurrencyError);

		expect(dispatched).toEqual([]);
	});

	it("throws when the dispatcher throws, surfacing the SQS-retry signal", async () => {
		// This is the contract that closes class #2: if a handler returns
		// without throwing, every effect has been dispatched. The dispatcher
		// throwing here is what forces the handler to throw, which is what
		// keeps the SQS message in flight for redelivery.
		const initial = buildArticle({ version: 1 });
		const { store } = initFakeStore(initial);
		const { dispatcher, failOnce } = initFakeDispatcher();
		failOnce();
		const transitionAndPersist = initTransitionAndPersist({ store, dispatcher });

		await expect(
			transitionAndPersist({
				url: initial.url,
				transition: refreshContent,
				params: refreshParams,
			}),
		).rejects.toThrow("dispatcher exploded");
	});

	it("rebases against the new version on AggregateConcurrencyError and retries within budget", async () => {
		const initial = buildArticle({ version: 4 });
		const { store, log, failNextSavesWithConflict } = initFakeStore(initial);
		const { dispatcher, dispatched } = initFakeDispatcher();
		failNextSavesWithConflict(2);
		const transitionAndPersist = initTransitionAndPersist({
			store,
			dispatcher,
			retryBudget: 3,
		});

		await transitionAndPersist({
			url: initial.url,
			transition: requestRecrawl,
			params: undefined,
		});

		// 1 initial save attempt + 2 conflicts = 3 saves total, then the 4th
		// (with the rebased version) succeeds.
		expect(log.saves.length).toBe(3);
		expect(log.saves[0]?.expectedVersion).toBe(4);
		expect(log.saves[1]?.expectedVersion).toBe(5);
		expect(log.saves[2]?.expectedVersion).toBe(6);
		expect(dispatched).toEqual([
			[{ kind: "PublishRecrawlLinkInitiatedEvent", url: initial.url }],
		]);
	});

	it("does NOT retry on non-concurrency save errors — surfaces the failure to SQS", async () => {
		// Concurrency conflicts are expected and rebase-safe; everything else
		// (DDB throttle, IAM, network) needs SQS to retry the whole message,
		// not the orchestrator rebasing in-process. The orchestrator
		// distinguishes the two by checking the error type.
		const initial = buildArticle({ version: 1 });
		const failingStore: ArticleStore = {
			load: async () => initial,
			save: async () => {
				throw new Error("DDB ThrottlingException");
			},
		};
		const { dispatcher, dispatched } = initFakeDispatcher();
		const transitionAndPersist = initTransitionAndPersist({
			store: failingStore,
			dispatcher,
			retryBudget: 5,
		});

		await expect(
			transitionAndPersist({
				url: initial.url,
				transition: refreshContent,
				params: refreshParams,
			}),
		).rejects.toThrow("DDB ThrottlingException");
		expect(dispatched).toEqual([]);
	});

	it("uses the default retry budget when none is provided", async () => {
		// Asserts the default-budget code path runs; otherwise the `??`
		// fallback in DEFAULT_RETRY_BUDGET sits uncovered for any reader
		// inspecting how this function is configured.
		const initial = buildArticle({ version: 1 });
		const { store } = initFakeStore(initial);
		const { dispatcher, dispatched } = initFakeDispatcher();
		const transitionAndPersist = initTransitionAndPersist({
			store,
			dispatcher,
		});

		await transitionAndPersist({
			url: initial.url,
			transition: refreshContent,
			params: refreshParams,
		});

		expect(dispatched).toHaveLength(1);
	});

	it("fails when the URL has no aggregate row at all", async () => {
		const initial = buildArticle();
		const { store } = initFakeStore(initial);
		const { dispatcher } = initFakeDispatcher();
		const transitionAndPersist = initTransitionAndPersist({ store, dispatcher });

		await expect(
			transitionAndPersist({
				url: "https://other.example.com/missing",
				transition: refreshContent,
				params: refreshParams,
			}),
		).rejects.toThrow(/no aggregate found/);
	});
});
