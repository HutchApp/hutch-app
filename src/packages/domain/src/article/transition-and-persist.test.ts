import assert from "node:assert/strict";
import type { Article } from "./aggregate.types";
import type { Minutes } from "./article.types";
import type { DispatchEffects, Effect } from "./effect.types";
import { initTransitionAndPersist } from "./transition-and-persist";
import { refreshContent } from "./transitions/refresh-content";
import { requestRecrawl } from "./transitions/request-recrawl";
import type { ArticleStore } from "./storage.types";

function buildArticle(overrides: Partial<Article> = {}): Article {
	return {
		url: "https://example.com/article",
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
	saves: Article[];
}

function initFakeStore(initial: Article): {
	store: ArticleStore;
	log: FakeStoreCallLog;
} {
	let current: Article = initial;
	const log: FakeStoreCallLog = { loads: [], saves: [] };

	const store: ArticleStore = {
		load: async (url) => {
			log.loads.push(url);
			return current.url === url ? current : undefined;
		},
		save: async (article) => {
			log.saves.push(article);
			current = article;
		},
	};

	return { store, log };
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

	it("loads, applies transition, saves, then dispatches effects", async () => {
		const initial = buildArticle();
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
		expect(log.saves[0]?.summary).toEqual({ status: "pending" });
		expect(dispatched).toEqual([
			[{ kind: "DispatchGenerateSummaryCommand", url: initial.url }],
		]);
	});

	it("dispatches AFTER save so a failed save never produces a phantom event", async () => {
		const initial = buildArticle();
		const { store } = initFakeStore(initial);
		const callOrder: string[] = [];
		const wrappedStore: ArticleStore = {
			load: async (u) => {
				callOrder.push("load");
				return store.load(u);
			},
			save: async (a) => {
				callOrder.push("save");
				return store.save(a);
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

	it("throws and does NOT dispatch when the storage save fails", async () => {
		const initial = buildArticle();
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

	it("throws when the dispatcher throws, surfacing the SQS-retry signal", async () => {
		const initial = buildArticle();
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

	it("resolves to undefined when skipIfMissing is set and the URL has no aggregate row", async () => {
		const initial = buildArticle();
		const { store, log } = initFakeStore(initial);
		const { dispatcher, dispatched } = initFakeDispatcher();
		const transitionAndPersist = initTransitionAndPersist({ store, dispatcher });

		const result = await transitionAndPersist({
			url: "https://other.example.com/missing",
			transition: refreshContent,
			params: refreshParams,
			skipIfMissing: true,
		});

		expect(result).toBeUndefined();
		expect(log.saves).toEqual([]);
		expect(dispatched).toEqual([]);
	});

	it("works with requestRecrawl transition", async () => {
		const initial = buildArticle();
		const { store } = initFakeStore(initial);
		const { dispatcher, dispatched } = initFakeDispatcher();
		const transitionAndPersist = initTransitionAndPersist({ store, dispatcher });

		await transitionAndPersist({
			url: initial.url,
			transition: requestRecrawl,
			params: undefined,
		});

		expect(dispatched).toEqual([
			[{ kind: "PublishRecrawlLinkInitiatedEvent", url: initial.url }],
		]);
	});
});
