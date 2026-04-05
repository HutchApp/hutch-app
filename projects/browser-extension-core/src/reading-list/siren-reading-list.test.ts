import assert from "node:assert/strict";
import type { ReadingListItemId } from "../domain/reading-list-item.types";
import { initSirenReadingList, type SirenReadingListDeps } from "./siren-reading-list";

const COLLECTION_ACTIONS = [
	{ name: "save-article", href: "/queue", method: "POST", type: "application/json", fields: [{ name: "url", type: "url" }] },
	{ name: "filter-by-status", href: "/queue", method: "GET", fields: [{ name: "status", type: "text" }, { name: "url", type: "url" }] },
];

function collectionResponse(entities: unknown[] = []) {
	return JSON.stringify({
		class: ["collection", "articles"],
		entities,
		links: [{ rel: ["self"], href: "/queue" }],
		actions: COLLECTION_ACTIONS,
	});
}

function articleEntity(overrides: { id: string; url: string; title: string; savedAt: string; links?: unknown[]; actions?: unknown[] }) {
	return {
		class: ["article"],
		rel: ["item"],
		properties: {
			id: overrides.id,
			url: overrides.url,
			title: overrides.title,
			savedAt: overrides.savedAt,
		},
		links: overrides.links ?? [{ rel: ["read"], href: `/queue/${overrides.id}/read` }],
		actions: overrides.actions ?? [{ name: "delete", href: `/queue/${overrides.id}/delete`, method: "POST" }],
	};
}

type Route = { status: number; body?: string; headers?: Record<string, string> };

function createRoutingFetch(routes: Record<string, Route>): { fetchFn: SirenReadingListDeps["fetchFn"]; calls: string[] } {
	const calls: string[] = [];
	const fetchFn: SirenReadingListDeps["fetchFn"] = async (input, init) => {
		const url = typeof input === "string" ? input : (input as URL).toString();
		const method = init?.method ?? "GET";
		const key = `${method} ${url}`;
		calls.push(key);
		const route = routes[key];
		if (!route) throw new Error(`Unexpected fetch: ${key}`);
		return new Response(route.body ?? null, { status: route.status, headers: route.headers });
	};
	return { fetchFn, calls };
}

function createDeps(fetchFn: SirenReadingListDeps["fetchFn"]): SirenReadingListDeps {
	return {
		serverUrl: "http://localhost:3000",
		getAccessToken: async () => "test-token",
		fetchFn,
	};
}

describe("initSirenReadingList", () => {
	describe("saveUrl", () => {
		it("should discover save-article action from collection, then POST to it", async () => {
			const savedAt = "2026-01-15T10:00:00.000Z";
			const { fetchFn, calls } = createRoutingFetch({
				"GET http://localhost:3000/queue": {
					status: 200,
					body: collectionResponse(),
				},
				"POST http://localhost:3000/queue": {
					status: 201,
					body: JSON.stringify({
						class: ["article"],
						properties: { id: "article-1", url: "https://example.com/article", title: "Article from example.com", savedAt },
						actions: [{ name: "delete", href: "/queue/article-1/delete", method: "POST" }],
					}),
				},
			});
			const list = initSirenReadingList(createDeps(fetchFn));

			const result = await list.saveUrl({ url: "https://example.com/article", title: "Ignored" });
			assert.equal(result.ok, true, "save should succeed");
			const item = (result as Extract<typeof result, { ok: true }>).item;

			expect(item.url).toBe("https://example.com/article");
			expect(item.title).toBe("Article from example.com");
			expect(item.id).toBe("article-1");
			expect(item.savedAt).toEqual(new Date(savedAt));
			expect(calls).toEqual([
				"GET http://localhost:3000/queue",
				"POST http://localhost:3000/queue",
			]);
		});

		it("should include readUrl when server returns a read link", async () => {
			const { fetchFn } = createRoutingFetch({
				"GET http://localhost:3000/queue": {
					status: 200,
					body: collectionResponse(),
				},
				"POST http://localhost:3000/queue": {
					status: 201,
					body: JSON.stringify({
						class: ["article"],
						properties: { id: "article-1", url: "https://example.com/article", title: "Article", savedAt: "2026-01-15T10:00:00.000Z" },
						links: [{ rel: ["self"], href: "/queue/article-1" }, { rel: ["read"], href: "/queue/article-1/read" }],
						actions: [{ name: "delete", href: "/queue/article-1/delete", method: "POST" }],
					}),
				},
			});
			const list = initSirenReadingList(createDeps(fetchFn));

			const result = await list.saveUrl({ url: "https://example.com/article", title: "Ignored" });
			const item = (result as Extract<typeof result, { ok: true }>).item;

			expect(item.readUrl).toBe("http://localhost:3000/queue/article-1/read");
		});

		it("should have undefined readUrl when server returns no read link", async () => {
			const { fetchFn } = createRoutingFetch({
				"GET http://localhost:3000/queue": {
					status: 200,
					body: collectionResponse(),
				},
				"POST http://localhost:3000/queue": {
					status: 201,
					body: JSON.stringify({
						class: ["article"],
						properties: { id: "article-1", url: "https://example.com/article", title: "Article", savedAt: "2026-01-15T10:00:00.000Z" },
						links: [{ rel: ["self"], href: "/queue/article-1" }],
						actions: [{ name: "delete", href: "/queue/article-1/delete", method: "POST" }],
					}),
				},
			});
			const list = initSirenReadingList(createDeps(fetchFn));

			const result = await list.saveUrl({ url: "https://example.com/article", title: "Ignored" });
			const item = (result as Extract<typeof result, { ok: true }>).item;

			expect(item.readUrl).toBeUndefined();
		});

		it("should throw when server returns an error on save", async () => {
			const { fetchFn } = createRoutingFetch({
				"GET http://localhost:3000/queue": {
					status: 200,
					body: collectionResponse(),
				},
				"POST http://localhost:3000/queue": {
					status: 422,
				},
			});
			const list = initSirenReadingList(createDeps(fetchFn));

			await expect(
				list.saveUrl({ url: "bad-url", title: "Test" }),
			).rejects.toThrow("Save failed: 422");
		});

		it("should throw when collection fetch fails during action discovery", async () => {
			const { fetchFn } = createRoutingFetch({
				"GET http://localhost:3000/queue": {
					status: 500,
				},
			});
			const list = initSirenReadingList(createDeps(fetchFn));

			await expect(
				list.saveUrl({ url: "https://example.com", title: "Test" }),
			).rejects.toThrow("Fetch failed: 500");
		});

		it("should fall back to application/json when save-article action has no type", async () => {
			const actionsWithoutType = [
				{ name: "save-article", href: "/queue", method: "POST", fields: [{ name: "url", type: "url" }] },
				COLLECTION_ACTIONS[1],
			];
			const { fetchFn } = createRoutingFetch({
				"GET http://localhost:3000/queue": {
					status: 200,
					body: JSON.stringify({ actions: actionsWithoutType }),
				},
				"POST http://localhost:3000/queue": {
					status: 201,
					body: JSON.stringify({
						class: ["article"],
						properties: { id: "article-1", url: "https://example.com/a", title: "A", savedAt: "2026-01-15T10:00:00.000Z" },
						actions: [{ name: "delete", href: "/queue/article-1/delete", method: "POST" }],
					}),
				},
			});
			const list = initSirenReadingList(createDeps(fetchFn));

			const result = await list.saveUrl({ url: "https://example.com/a", title: "A" });

			assert.equal(result.ok, true);
		});

		it("should reuse cached actions on second save (no extra collection fetch)", async () => {
			const { fetchFn, calls } = createRoutingFetch({
				"GET http://localhost:3000/queue": {
					status: 200,
					body: collectionResponse(),
				},
				"POST http://localhost:3000/queue": {
					status: 201,
					body: JSON.stringify({
						class: ["article"],
						properties: { id: "article-1", url: "https://example.com/a", title: "A", savedAt: "2026-01-15T10:00:00.000Z" },
						actions: [{ name: "delete", href: "/queue/article-1/delete", method: "POST" }],
					}),
				},
			});
			const list = initSirenReadingList(createDeps(fetchFn));

			await list.saveUrl({ url: "https://example.com/a", title: "A" });
			await list.saveUrl({ url: "https://example.com/b", title: "B" });

			const collectionFetches = calls.filter((c) => c === "GET http://localhost:3000/queue");
			expect(collectionFetches).toHaveLength(1);
		});
	});

	describe("removeUrl", () => {
		it("should use tracked delete action from prior getAllItems", async () => {
			const { fetchFn, calls } = createRoutingFetch({
				"GET http://localhost:3000/queue": {
					status: 200,
					body: collectionResponse([
						articleEntity({ id: "article-1", url: "https://example.com/a", title: "A", savedAt: "2026-01-15T10:00:00.000Z" }),
					]),
				},
				"POST http://localhost:3000/queue/article-1/delete": {
					status: 204,
				},
			});
			const list = initSirenReadingList(createDeps(fetchFn));

			await list.getAllItems();
			const result = await list.removeUrl("article-1" as ReadingListItemId);

			expect(result).toEqual({ ok: true });
			expect(calls).toEqual([
				"GET http://localhost:3000/queue",
				"POST http://localhost:3000/queue/article-1/delete",
			]);
		});

		it("should fall back to fetching collection when delete action not tracked", async () => {
			const { fetchFn, calls } = createRoutingFetch({
				"GET http://localhost:3000/queue": {
					status: 200,
					body: collectionResponse([
						articleEntity({ id: "article-1", url: "https://example.com/a", title: "A", savedAt: "2026-01-15T10:00:00.000Z" }),
					]),
				},
				"POST http://localhost:3000/queue/article-1/delete": {
					status: 204,
				},
			});
			const list = initSirenReadingList(createDeps(fetchFn));

			const result = await list.removeUrl("article-1" as ReadingListItemId);

			expect(result).toEqual({ ok: true });
			expect(calls).toEqual([
				"GET http://localhost:3000/queue",
				"POST http://localhost:3000/queue/article-1/delete",
			]);
		});

		it("should return ok when server responds with 303 redirect", async () => {
			const { fetchFn } = createRoutingFetch({
				"GET http://localhost:3000/queue": {
					status: 200,
					body: collectionResponse([
						articleEntity({ id: "article-1", url: "https://example.com/a", title: "A", savedAt: "2026-01-15T10:00:00.000Z" }),
					]),
				},
				"POST http://localhost:3000/queue/article-1/delete": {
					status: 303,
				},
			});
			const list = initSirenReadingList(createDeps(fetchFn));

			const result = await list.removeUrl("article-1" as ReadingListItemId);

			expect(result).toEqual({ ok: true });
		});

		it("should return not-found when server responds with non-204/303", async () => {
			const { fetchFn } = createRoutingFetch({
				"GET http://localhost:3000/queue": {
					status: 200,
					body: collectionResponse([
						articleEntity({ id: "article-1", url: "https://example.com/a", title: "A", savedAt: "2026-01-15T10:00:00.000Z" }),
					]),
				},
				"POST http://localhost:3000/queue/article-1/delete": {
					status: 404,
				},
			});
			const list = initSirenReadingList(createDeps(fetchFn));

			const result = await list.removeUrl("article-1" as ReadingListItemId);

			expect(result).toEqual({ ok: false, reason: "not-found" });
		});

		it("should throw when entity has no delete action", async () => {
			const { fetchFn } = createRoutingFetch({
				"GET http://localhost:3000/queue": {
					status: 200,
					body: collectionResponse([
						articleEntity({ id: "article-1", url: "https://example.com/a", title: "A", savedAt: "2026-01-15T10:00:00.000Z", actions: [] }),
					]),
				},
			});
			const list = initSirenReadingList(createDeps(fetchFn));

			await expect(
				list.removeUrl("article-1" as ReadingListItemId),
			).rejects.toThrow('No delete action found for item article-1');
		});

		it("should throw when fallback collection fetch fails", async () => {
			const { fetchFn } = createRoutingFetch({
				"GET http://localhost:3000/queue": {
					status: 500,
				},
			});
			const list = initSirenReadingList(createDeps(fetchFn));

			await expect(
				list.removeUrl("article-1" as ReadingListItemId),
			).rejects.toThrow('No delete action found for item article-1');
		});

		it("should throw when fallback collection has no entities", async () => {
			const { fetchFn } = createRoutingFetch({
				"GET http://localhost:3000/queue": {
					status: 200,
					body: JSON.stringify({ actions: COLLECTION_ACTIONS }),
				},
			});
			const list = initSirenReadingList(createDeps(fetchFn));

			await expect(
				list.removeUrl("article-1" as ReadingListItemId),
			).rejects.toThrow('No delete action found for item article-1');
		});

		it("should skip entities without properties during fallback discovery", async () => {
			const { fetchFn } = createRoutingFetch({
				"GET http://localhost:3000/queue": {
					status: 200,
					body: JSON.stringify({
						entities: [
							{},
							{ properties: { id: "article-1", url: "https://example.com/a", title: "A", savedAt: "2026-01-15T10:00:00.000Z" }, actions: [{ name: "delete", href: "/queue/article-1/delete", method: "POST" }] },
						],
						actions: COLLECTION_ACTIONS,
					}),
				},
				"POST http://localhost:3000/queue/article-1/delete": {
					status: 204,
				},
			});
			const list = initSirenReadingList(createDeps(fetchFn));

			const result = await list.removeUrl("article-1" as ReadingListItemId);

			expect(result).toEqual({ ok: true });
		});

		it("should skip entities with invalid properties during fallback discovery", async () => {
			const { fetchFn } = createRoutingFetch({
				"GET http://localhost:3000/queue": {
					status: 200,
					body: JSON.stringify({
						entities: [
							{ properties: { unexpected: "shape" } },
							{ properties: { id: "article-1", url: "https://example.com/a", title: "A", savedAt: "2026-01-15T10:00:00.000Z" }, actions: [{ name: "delete", href: "/queue/article-1/delete", method: "POST" }] },
						],
						actions: COLLECTION_ACTIONS,
					}),
				},
				"POST http://localhost:3000/queue/article-1/delete": {
					status: 204,
				},
			});
			const list = initSirenReadingList(createDeps(fetchFn));

			const result = await list.removeUrl("article-1" as ReadingListItemId);

			expect(result).toEqual({ ok: true });
		});
	});

	describe("findByUrl", () => {
		it("should use filter action to find by URL", async () => {
			const { fetchFn, calls } = createRoutingFetch({
				"GET http://localhost:3000/queue": {
					status: 200,
					body: collectionResponse(),
				},
				"GET http://localhost:3000/queue?url=https%3A%2F%2Fexample.com%2Farticle": {
					status: 200,
					body: collectionResponse([
						articleEntity({ id: "article-1", url: "https://example.com/article", title: "Found Article", savedAt: "2026-01-15T10:00:00.000Z" }),
					]),
				},
			});
			const list = initSirenReadingList(createDeps(fetchFn));

			const found = await list.findByUrl("https://example.com/article");

			expect(found?.url).toBe("https://example.com/article");
			expect(found?.title).toBe("Found Article");
			expect(calls).toEqual([
				"GET http://localhost:3000/queue",
				"GET http://localhost:3000/queue?url=https%3A%2F%2Fexample.com%2Farticle",
			]);
		});

		it("should return null when no entities match", async () => {
			const { fetchFn } = createRoutingFetch({
				"GET http://localhost:3000/queue": {
					status: 200,
					body: collectionResponse(),
				},
				"GET http://localhost:3000/queue?url=https%3A%2F%2Fexample.com%2Fmissing": {
					status: 200,
					body: collectionResponse(),
				},
			});
			const list = initSirenReadingList(createDeps(fetchFn));

			const found = await list.findByUrl("https://example.com/missing");

			expect(found).toBeNull();
		});

		it("should return null when response has no entities property", async () => {
			const { fetchFn } = createRoutingFetch({
				"GET http://localhost:3000/queue": {
					status: 200,
					body: collectionResponse(),
				},
				"GET http://localhost:3000/queue?url=https%3A%2F%2Fexample.com%2Fmissing": {
					status: 200,
					body: JSON.stringify({ actions: COLLECTION_ACTIONS }),
				},
			});
			const list = initSirenReadingList(createDeps(fetchFn));

			const found = await list.findByUrl("https://example.com/missing");

			expect(found).toBeNull();
		});

		it("should return null when server returns an error on filter", async () => {
			const { fetchFn } = createRoutingFetch({
				"GET http://localhost:3000/queue": {
					status: 200,
					body: collectionResponse(),
				},
				"GET http://localhost:3000/queue?url=https%3A%2F%2Fexample.com%2Farticle": {
					status: 401,
				},
			});
			const list = initSirenReadingList(createDeps(fetchFn));

			const found = await list.findByUrl("https://example.com/article");

			expect(found).toBeNull();
		});
	});

	describe("toReadingListItem error handling", () => {
		it("throws when server response entity has no properties", async () => {
			const { fetchFn } = createRoutingFetch({
				"GET http://localhost:3000/queue": {
					status: 200,
					body: collectionResponse([{}]),
				},
			});
			const list = initSirenReadingList(createDeps(fetchFn));

			await expect(list.getAllItems()).rejects.toThrow(
				"Server response entity missing properties",
			);
		});

		it("throws when server response entity properties are missing required fields", async () => {
			const { fetchFn } = createRoutingFetch({
				"GET http://localhost:3000/queue": {
					status: 200,
					body: collectionResponse([{ properties: { id: "1", url: "https://example.com" } }]),
				},
			});
			const list = initSirenReadingList(createDeps(fetchFn));

			await expect(list.getAllItems()).rejects.toThrow();
		});
	});

	describe("authHeaders error handling", () => {
		it("throws when access token is null", async () => {
			const deps: SirenReadingListDeps = {
				serverUrl: "http://localhost:3000",
				getAccessToken: async () => null,
				fetchFn: async () => new Response(null, { status: 200 }),
			};
			const list = initSirenReadingList(deps);

			await expect(list.getAllItems()).rejects.toThrow(
				"No access token available",
			);
		});
	});

	describe("getAllItems", () => {
		it("should return all items from the collection", async () => {
			const { fetchFn } = createRoutingFetch({
				"GET http://localhost:3000/queue": {
					status: 200,
					body: collectionResponse([
						articleEntity({ id: "1", url: "https://example.com/a", title: "A", savedAt: "2026-01-15T10:00:00.000Z" }),
						articleEntity({ id: "2", url: "https://example.com/b", title: "B", savedAt: "2026-01-15T11:00:00.000Z" }),
					]),
				},
			});
			const list = initSirenReadingList(createDeps(fetchFn));

			const items = await list.getAllItems();

			expect(items.map(i => i.url)).toEqual(["https://example.com/a", "https://example.com/b"]);
		});

		it("should include readUrl for items with read links", async () => {
			const { fetchFn } = createRoutingFetch({
				"GET http://localhost:3000/queue": {
					status: 200,
					body: collectionResponse([
						articleEntity({ id: "1", url: "https://example.com/a", title: "A", savedAt: "2026-01-15T10:00:00.000Z" }),
						articleEntity({
							id: "2", url: "https://example.com/b", title: "B", savedAt: "2026-01-15T11:00:00.000Z",
							links: [{ rel: ["self"], href: "/queue/2" }],
						}),
					]),
				},
			});
			const list = initSirenReadingList(createDeps(fetchFn));

			const items = await list.getAllItems();

			expect(items[0].readUrl).toBe("http://localhost:3000/queue/1/read");
			expect(items[1].readUrl).toBeUndefined();
		});

		it("should return empty array when collection is empty", async () => {
			const { fetchFn } = createRoutingFetch({
				"GET http://localhost:3000/queue": {
					status: 200,
					body: collectionResponse(),
				},
			});
			const list = initSirenReadingList(createDeps(fetchFn));

			const items = await list.getAllItems();

			expect(items).toEqual([]);
		});

		it("should return empty array when response has no entities property", async () => {
			const { fetchFn } = createRoutingFetch({
				"GET http://localhost:3000/queue": {
					status: 200,
					body: JSON.stringify({ actions: COLLECTION_ACTIONS }),
				},
			});
			const list = initSirenReadingList(createDeps(fetchFn));

			const items = await list.getAllItems();

			expect(items).toEqual([]);
		});

		it("should cache empty actions when response has no actions property", async () => {
			const { fetchFn, calls } = createRoutingFetch({
				"GET http://localhost:3000/queue": {
					status: 200,
					body: JSON.stringify({ entities: [] }),
				},
			});
			const list = initSirenReadingList(createDeps(fetchFn));

			await list.getAllItems();

			await expect(
				list.saveUrl({ url: "https://example.com", title: "Test" }),
			).rejects.toThrow('Expected Siren action "save-article" not found in response');
			const collectionFetches = calls.filter((c) => c === "GET http://localhost:3000/queue");
			expect(collectionFetches).toHaveLength(1);
		});

		it("should throw when server returns an error", async () => {
			const { fetchFn } = createRoutingFetch({
				"GET http://localhost:3000/queue": {
					status: 500,
				},
			});
			const list = initSirenReadingList(createDeps(fetchFn));

			await expect(list.getAllItems()).rejects.toThrow("Fetch failed: 500");
		});

		it("should cache collection actions so subsequent saveUrl skips the fetch", async () => {
			const { fetchFn, calls } = createRoutingFetch({
				"GET http://localhost:3000/queue": {
					status: 200,
					body: collectionResponse(),
				},
				"POST http://localhost:3000/queue": {
					status: 201,
					body: JSON.stringify({
						class: ["article"],
						properties: { id: "article-1", url: "https://example.com/a", title: "A", savedAt: "2026-01-15T10:00:00.000Z" },
						actions: [{ name: "delete", href: "/queue/article-1/delete", method: "POST" }],
					}),
				},
			});
			const list = initSirenReadingList(createDeps(fetchFn));

			await list.getAllItems();
			await list.saveUrl({ url: "https://example.com/a", title: "A" });

			const collectionFetches = calls.filter((c) => c === "GET http://localhost:3000/queue");
			expect(collectionFetches).toHaveLength(1);
		});
	});

	describe("action discovery errors", () => {
		it("should throw when save-article action is missing from collection", async () => {
			const { fetchFn } = createRoutingFetch({
				"GET http://localhost:3000/queue": {
					status: 200,
					body: JSON.stringify({ entities: [] }),
				},
			});
			const list = initSirenReadingList(createDeps(fetchFn));

			await expect(
				list.saveUrl({ url: "https://example.com", title: "Test" }),
			).rejects.toThrow('Expected Siren action "save-article" not found in response');
		});

		it("should throw when filter-by-status action is missing from collection", async () => {
			const { fetchFn } = createRoutingFetch({
				"GET http://localhost:3000/queue": {
					status: 200,
					body: JSON.stringify({ entities: [], actions: [] }),
				},
			});
			const list = initSirenReadingList(createDeps(fetchFn));

			await expect(
				list.findByUrl("https://example.com"),
			).rejects.toThrow('Expected Siren action "filter-by-status" not found in response');
		});
	});
});
