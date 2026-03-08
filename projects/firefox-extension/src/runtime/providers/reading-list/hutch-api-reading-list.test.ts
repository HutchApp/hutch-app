import type { ReadingListItemId } from "../../domain/reading-list-item.types";
import { initHutchApiReadingList } from "./hutch-api-reading-list";

function createFetchMock() {
	let nextResponse: { status: number; body: unknown } = {
		status: 200,
		body: {},
	};

	const mockFetch = jest.fn(async () => ({
		ok: nextResponse.status >= 200 && nextResponse.status < 300,
		status: nextResponse.status,
		json: async () => nextResponse.body,
	})) as unknown as jest.Mock & typeof fetch;

	return {
		fetchFn: mockFetch as typeof fetch,
		mockFetch,
		setResponse(response: { status: number; body: unknown }) {
			nextResponse = response;
		},
	};
}

describe("initHutchApiReadingList", () => {
	const serverUrl = "https://hutch-app.com";
	const validToken = "test-access-token";

	describe("saveUrl", () => {
		it("should POST to /api/articles with Bearer token and return the saved item", async () => {
			const mock = createFetchMock();
			mock.setResponse({
				status: 201,
				body: {
					id: "article-1",
					url: "https://example.com/article",
					title: "Example Article",
					savedAt: "2026-03-07T00:00:00.000Z",
				},
			});
			const list = initHutchApiReadingList({
				serverUrl,
				getAccessToken: async () => validToken,
				fetchFn: mock.fetchFn,
			});

			const result = await list.saveUrl({
				url: "https://example.com/article",
				title: "Example Article",
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.item.url).toBe("https://example.com/article");
				expect(result.item.title).toBe("Example Article");
				expect(result.item.id).toBe("article-1");
			}

			const [fetchUrl, fetchOptions] = mock.mockFetch.mock.calls[0];
			expect(fetchUrl).toBe(`${serverUrl}/api/articles`);
			expect(fetchOptions.method).toBe("POST");
			expect(fetchOptions.headers.Authorization).toBe(
				`Bearer ${validToken}`,
			);
			expect(JSON.parse(fetchOptions.body)).toEqual({
				url: "https://example.com/article",
				title: "Example Article",
			});
		});

		it("should throw when server returns a generic error", async () => {
			const mock = createFetchMock();
			mock.setResponse({
				status: 500,
				body: { message: "Internal Server Error" },
			});
			const list = initHutchApiReadingList({
				serverUrl,
				getAccessToken: async () => validToken,
				fetchFn: mock.fetchFn,
			});

			await expect(
				list.saveUrl({
					url: "https://example.com/fail",
					title: "Fail",
				}),
			).rejects.toThrow("Save failed: 500");
		});

		it("should throw when server returns error and json parsing fails", async () => {
			const mockFetch = jest.fn(async () => ({
				ok: false,
				status: 502,
				json: async () => {
					throw new Error("invalid json");
				},
			})) as unknown as typeof fetch;
			const list = initHutchApiReadingList({
				serverUrl,
				getAccessToken: async () => validToken,
				fetchFn: mockFetch,
			});

			await expect(
				list.saveUrl({
					url: "https://example.com/fail",
					title: "Fail",
				}),
			).rejects.toThrow("Save failed: 502");
		});

		it("should return already-saved when server responds with that reason", async () => {
			const mock = createFetchMock();
			mock.setResponse({
				status: 409,
				body: { reason: "already-saved" },
			});
			const list = initHutchApiReadingList({
				serverUrl,
				getAccessToken: async () => validToken,
				fetchFn: mock.fetchFn,
			});

			const result = await list.saveUrl({
				url: "https://example.com/dup",
				title: "Duplicate",
			});

			expect(result).toEqual({ ok: false, reason: "already-saved" });
		});
	});

	describe("removeUrl", () => {
		it("should DELETE /api/articles/:id with Bearer token", async () => {
			const mock = createFetchMock();
			mock.setResponse({ status: 200, body: {} });
			const list = initHutchApiReadingList({
				serverUrl,
				getAccessToken: async () => validToken,
				fetchFn: mock.fetchFn,
			});

			const result = await list.removeUrl(
				"article-1" as ReadingListItemId,
			);

			expect(result).toEqual({ ok: true });

			const [fetchUrl, fetchOptions] = mock.mockFetch.mock.calls[0];
			expect(fetchUrl).toBe(`${serverUrl}/api/articles/article-1`);
			expect(fetchOptions.method).toBe("DELETE");
			expect(fetchOptions.headers.Authorization).toBe(
				`Bearer ${validToken}`,
			);
		});

		it("should throw when server returns a generic error", async () => {
			const mock = createFetchMock();
			mock.setResponse({
				status: 500,
				body: { message: "Internal Server Error" },
			});
			const list = initHutchApiReadingList({
				serverUrl,
				getAccessToken: async () => validToken,
				fetchFn: mock.fetchFn,
			});

			await expect(
				list.removeUrl("article-1" as ReadingListItemId),
			).rejects.toThrow("Remove failed: 500");
		});

		it("should throw when server error json parsing fails", async () => {
			const mockFetch = jest.fn(async () => ({
				ok: false,
				status: 502,
				json: async () => {
					throw new Error("invalid json");
				},
			})) as unknown as typeof fetch;
			const list = initHutchApiReadingList({
				serverUrl,
				getAccessToken: async () => validToken,
				fetchFn: mockFetch,
			});

			await expect(
				list.removeUrl("article-1" as ReadingListItemId),
			).rejects.toThrow("Remove failed: 502");
		});

		it("should return not-found when article does not exist", async () => {
			const mock = createFetchMock();
			mock.setResponse({
				status: 404,
				body: { reason: "not-found" },
			});
			const list = initHutchApiReadingList({
				serverUrl,
				getAccessToken: async () => validToken,
				fetchFn: mock.fetchFn,
			});

			const result = await list.removeUrl(
				"nonexistent" as ReadingListItemId,
			);

			expect(result).toEqual({ ok: false, reason: "not-found" });
		});
	});

	describe("findByUrl", () => {
		it("should GET /api/articles/find with url query parameter", async () => {
			const mock = createFetchMock();
			mock.setResponse({
				status: 200,
				body: {
					id: "article-1",
					url: "https://example.com/found",
					title: "Found Article",
					savedAt: "2026-03-07T00:00:00.000Z",
				},
			});
			const list = initHutchApiReadingList({
				serverUrl,
				getAccessToken: async () => validToken,
				fetchFn: mock.fetchFn,
			});

			const found = await list.findByUrl("https://example.com/found");

			expect(found?.url).toBe("https://example.com/found");
			expect(found?.title).toBe("Found Article");

			const [fetchUrl] = mock.mockFetch.mock.calls[0];
			expect(fetchUrl).toContain("/api/articles/find?");
			expect(fetchUrl).toContain(
				`url=${encodeURIComponent("https://example.com/found")}`,
			);
		});

		it("should return null when response body is falsy", async () => {
			const mock = createFetchMock();
			mock.setResponse({ status: 200, body: null as unknown as object });
			const list = initHutchApiReadingList({
				serverUrl,
				getAccessToken: async () => validToken,
				fetchFn: mock.fetchFn,
			});

			const found = await list.findByUrl(
				"https://example.com/empty",
			);

			expect(found).toBeNull();
		});

		it("should return null when article is not found", async () => {
			const mock = createFetchMock();
			mock.setResponse({ status: 404, body: null });
			const list = initHutchApiReadingList({
				serverUrl,
				getAccessToken: async () => validToken,
				fetchFn: mock.fetchFn,
			});

			const found = await list.findByUrl(
				"https://example.com/missing",
			);

			expect(found).toBeNull();
		});
	});

	describe("getAllItems", () => {
		it("should GET /api/articles and return all items", async () => {
			const mock = createFetchMock();
			mock.setResponse({
				status: 200,
				body: [
					{
						id: "a1",
						url: "https://example.com/a",
						title: "Article A",
						savedAt: "2026-03-07T00:00:00.000Z",
					},
					{
						id: "a2",
						url: "https://example.com/b",
						title: "Article B",
						savedAt: "2026-03-07T01:00:00.000Z",
					},
				],
			});
			const list = initHutchApiReadingList({
				serverUrl,
				getAccessToken: async () => validToken,
				fetchFn: mock.fetchFn,
			});

			const items = await list.getAllItems();

			expect(items).toHaveLength(2);
			expect(items[0].url).toBe("https://example.com/a");
			expect(items[1].url).toBe("https://example.com/b");

			const [fetchUrl, fetchOptions] = mock.mockFetch.mock.calls[0];
			expect(fetchUrl).toBe(`${serverUrl}/api/articles`);
			expect(fetchOptions.headers.Authorization).toBe(
				`Bearer ${validToken}`,
			);
		});

		it("should throw when server returns an error", async () => {
			const mock = createFetchMock();
			mock.setResponse({ status: 500, body: {} });
			const list = initHutchApiReadingList({
				serverUrl,
				getAccessToken: async () => validToken,
				fetchFn: mock.fetchFn,
			});

			await expect(list.getAllItems()).rejects.toThrow(
				"Get all items failed: 500",
			);
		});

		it("should return empty array when no articles saved", async () => {
			const mock = createFetchMock();
			mock.setResponse({ status: 200, body: [] });
			const list = initHutchApiReadingList({
				serverUrl,
				getAccessToken: async () => validToken,
				fetchFn: mock.fetchFn,
			});

			const items = await list.getAllItems();

			expect(items).toEqual([]);
		});
	});

	describe("authorization header", () => {
		it("should omit Authorization header when no token available", async () => {
			const mock = createFetchMock();
			mock.setResponse({ status: 200, body: [] });
			const list = initHutchApiReadingList({
				serverUrl,
				getAccessToken: async () => null,
				fetchFn: mock.fetchFn,
			});

			await list.getAllItems();

			const [, fetchOptions] = mock.mockFetch.mock.calls[0];
			expect(fetchOptions.headers.Authorization).toBeUndefined();
		});
	});
});
