import { initRefreshArticleIfStale } from "./check-content-freshness";

function createDeps(overrides?: Record<string, unknown>) {
	return {
		findArticleFreshness: async (_url: string) => null,
		fetchConditional: async () => ({ changed: false as const }),
		fetchHtmlWithHeaders: async () => undefined,
		parseHtml: () => ({
			ok: true as const,
			article: {
				title: "Test",
				siteName: "example.com",
				excerpt: "Excerpt",
				wordCount: 100,
				content: "<p>Test</p>",
			},
		}),
		publishRefreshArticleContent: async () => {},
		publishUpdateFetchTimestamp: async () => {},

		logError: () => {},
		now: () => new Date("2026-03-20T10:00:00Z"),
		staleTtlMs: 86400000,
		...overrides,
	};
}

describe("refreshArticleIfStale", () => {
	it("returns action 'new' when no article exists for the URL", async () => {
		const deps = createDeps();
		const { refreshArticleIfStale } = initRefreshArticleIfStale(deps);

		const result = await refreshArticleIfStale({ url: "https://example.com/article" });

		expect(result.action).toBe("new");
	});

	it("returns action 'skip' when contentFetchedAt is within TTL", async () => {
		const deps = createDeps({
			findArticleFreshness: async () => ({
				etag: '"abc"',
				contentFetchedAt: "2026-03-20T09:00:00Z",
			}),
		});
		const { refreshArticleIfStale } = initRefreshArticleIfStale(deps);

		const result = await refreshArticleIfStale({ url: "https://example.com/article" });

		expect(result.action).toBe("skip");
	});

	it("returns action 'unchanged' on 304 conditional response", async () => {
		const publishCalled: string[] = [];
		const deps = createDeps({
			findArticleFreshness: async () => ({
				etag: '"abc"',
				contentFetchedAt: "2026-03-19T00:00:00Z",
			}),
			fetchConditional: async () => ({ changed: false }),
			publishUpdateFetchTimestamp: async () => { publishCalled.push("timestamp"); },
		});
		const { refreshArticleIfStale } = initRefreshArticleIfStale(deps);

		const result = await refreshArticleIfStale({ url: "https://example.com/article" });

		expect(result.action).toBe("unchanged");
		expect(publishCalled).toContain("timestamp");
	});

	it("returns action 'refreshed' on 200 conditional response", async () => {
		const publishCalled: string[] = [];
		const deps = createDeps({
			findArticleFreshness: async () => ({
				etag: '"abc"',
				contentFetchedAt: "2026-03-19T00:00:00Z",
			}),
			fetchConditional: async () => ({
				changed: true,
				html: "<html>New content</html>",
				etag: '"def"',
				lastModified: "Wed, 20 Mar 2026 10:00:00 GMT",
			}),
			publishRefreshArticleContent: async () => { publishCalled.push("refresh"); },
		});
		const { refreshArticleIfStale } = initRefreshArticleIfStale(deps);

		const result = await refreshArticleIfStale({ url: "https://example.com/article" });

		expect(result.action).toBe("refreshed");
		expect(publishCalled).toContain("refresh");
	});

	it("returns action 'refreshed' on full fetch when no conditional headers available", async () => {
		const deps = createDeps({
			findArticleFreshness: async () => ({
				contentFetchedAt: "2026-03-19T00:00:00Z",
			}),
			fetchHtmlWithHeaders: async () => ({
				html: "<html>Fresh</html>",
				etag: '"new"',
			}),
		});
		const { refreshArticleIfStale } = initRefreshArticleIfStale(deps);

		const result = await refreshArticleIfStale({ url: "https://example.com/article" });

		expect(result.action).toBe("refreshed");
	});

	it("returns action 'skip' when full fetch fails", async () => {
		const deps = createDeps({
			findArticleFreshness: async () => ({
				contentFetchedAt: "2026-03-19T00:00:00Z",
			}),
			fetchHtmlWithHeaders: async () => undefined,
		});
		const { refreshArticleIfStale } = initRefreshArticleIfStale(deps);

		const result = await refreshArticleIfStale({ url: "https://example.com/article" });

		expect(result.action).toBe("skip");
	});

	it("returns action 'skip' when conditional fetch throws an error", async () => {
		const deps = createDeps({
			findArticleFreshness: async () => ({
				etag: '"abc"',
				contentFetchedAt: "2026-03-19T00:00:00Z",
			}),
			fetchConditional: async () => { throw new Error("network error"); },
		});
		const { refreshArticleIfStale } = initRefreshArticleIfStale(deps);

		const result = await refreshArticleIfStale({ url: "https://example.com/article" });

		expect(result.action).toBe("skip");
	});

	it("returns action 'skip' when full fetch throws an error", async () => {
		const deps = createDeps({
			findArticleFreshness: async () => ({
				contentFetchedAt: "2026-03-19T00:00:00Z",
			}),
			fetchHtmlWithHeaders: async () => { throw new Error("network error"); },
		});
		const { refreshArticleIfStale } = initRefreshArticleIfStale(deps);

		const result = await refreshArticleIfStale({ url: "https://example.com/article" });

		expect(result.action).toBe("skip");
	});

	it("returns action 'skip' when parseHtml returns not ok after conditional fetch", async () => {
		const deps = createDeps({
			findArticleFreshness: async () => ({
				etag: '"abc"',
				contentFetchedAt: "2026-03-19T00:00:00Z",
			}),
			fetchConditional: async () => ({
				changed: true,
				html: "<html>Bad content</html>",
				etag: '"def"',
			}),
			parseHtml: () => ({ ok: false as const, reason: "could not parse" }),
		});
		const { refreshArticleIfStale } = initRefreshArticleIfStale(deps);

		const result = await refreshArticleIfStale({ url: "https://example.com/article" });

		expect(result.action).toBe("skip");
	});

	it("logs undefined when conditional fetch throws a non-Error value", async () => {
		const loggedErrors: (Error | undefined)[] = [];
		const deps = createDeps({
			findArticleFreshness: async () => ({
				etag: '"abc"',
				contentFetchedAt: "2026-03-19T00:00:00Z",
			}),
			fetchConditional: async () => { throw "string error"; },
			logError: (_msg: string, error?: Error) => { loggedErrors.push(error); },
		});
		const { refreshArticleIfStale } = initRefreshArticleIfStale(deps);

		const result = await refreshArticleIfStale({ url: "https://example.com/article" });

		expect(result.action).toBe("skip");
		expect(loggedErrors[0]).toBeUndefined();
	});

	it("logs undefined when full fetch throws a non-Error value", async () => {
		const loggedErrors: (Error | undefined)[] = [];
		const deps = createDeps({
			findArticleFreshness: async () => ({
				contentFetchedAt: "2026-03-19T00:00:00Z",
			}),
			fetchHtmlWithHeaders: async () => { throw "string error"; },
			logError: (_msg: string, error?: Error) => { loggedErrors.push(error); },
		});
		const { refreshArticleIfStale } = initRefreshArticleIfStale(deps);

		const result = await refreshArticleIfStale({ url: "https://example.com/article" });

		expect(result.action).toBe("skip");
		expect(loggedErrors[0]).toBeUndefined();
	});

	it("returns action 'skip' when parseHtml returns not ok after full fetch", async () => {
		const deps = createDeps({
			findArticleFreshness: async () => ({
				contentFetchedAt: "2026-03-19T00:00:00Z",
			}),
			fetchHtmlWithHeaders: async () => ({
				html: "<html>Bad content</html>",
				etag: '"new"',
			}),
			parseHtml: () => ({ ok: false as const, reason: "could not parse" }),
		});
		const { refreshArticleIfStale } = initRefreshArticleIfStale(deps);

		const result = await refreshArticleIfStale({ url: "https://example.com/article" });

		expect(result.action).toBe("skip");
	});
});
