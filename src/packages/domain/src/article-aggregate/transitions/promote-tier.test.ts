import assert from "node:assert/strict";
import type { Article } from "../article.types";
import type { Effect } from "../effects.types";
import { promoteTier } from "./promote-tier";

function buildArticle(overrides: Partial<Article> = {}): Article {
	return {
		url: "https://example.com/article",
		metadata: {
			title: "Hostname stub",
			siteName: "example.com",
			excerpt: "Saved from example.com.",
			wordCount: 0,
		},
		freshness: { contentFetchedAt: "2026-01-01T00:00:00.000Z" },
		estimatedReadTime: 0,
		crawl: { kind: "pending" },
		summary: { kind: "pending" },
		...overrides,
	};
}

describe("promoteTier", () => {
	const URL = "https://example.com/article";

	it("flips crawl to ready, overwrites metadata, refreshes contentFetchedAt, and resets summary to pending", () => {
		const before = buildArticle();

		const { article } = promoteTier(before, {
			tier: "tier-1",
			metadata: {
				title: "Real title",
				siteName: "Real Site",
				excerpt: "Real excerpt",
				wordCount: 500,
				imageUrl: "https://cdn.example.com/img.jpg",
			},
			estimatedReadTime: 3,
			contentFetchedAt: "2026-05-12T12:00:00.000Z",
			canonicalChanged: true,
			userId: "user-123",
		});

		assert.deepEqual(article.crawl, { kind: "ready" });
		assert.equal(article.metadata.title, "Real title");
		assert.equal(article.metadata.wordCount, 500);
		assert.equal(article.metadata.imageUrl, "https://cdn.example.com/img.jpg");
		assert.equal(article.estimatedReadTime, 3);
		assert.equal(article.freshness.contentFetchedAt, "2026-05-12T12:00:00.000Z");
		assert.deepEqual(article.summary, { kind: "pending" });
	});

	it("preserves freshness.etag and lastModified so the cache validators set by the original fetch are kept", () => {
		const before = buildArticle({
			freshness: {
				etag: '"abc"',
				lastModified: "Wed, 10 May 2026 12:00:00 GMT",
				contentFetchedAt: "2026-01-01T00:00:00.000Z",
			},
		});

		const { article } = promoteTier(before, {
			tier: "tier-0",
			metadata: before.metadata,
			estimatedReadTime: 0,
			contentFetchedAt: "2026-05-12T12:00:00.000Z",
			canonicalChanged: true,
		});

		assert.equal(article.freshness.etag, '"abc"');
		assert.equal(article.freshness.lastModified, "Wed, 10 May 2026 12:00:00 GMT");
	});

	it("declares writes for all four axes so the storage adapter rewrites them atomically", () => {
		const before = buildArticle();

		const { writes } = promoteTier(before, {
			tier: "tier-1",
			metadata: before.metadata,
			estimatedReadTime: 0,
			contentFetchedAt: "2026-05-12T12:00:00.000Z",
			canonicalChanged: true,
			userId: "u",
		});

		assert.deepEqual(
			[...writes].sort(),
			["crawl", "freshness", "metadata", "summary"],
		);
	});

	it("emits generate-summary and publish-crawl-article-completed unconditionally", () => {
		const before = buildArticle({ url: URL });

		const { effects } = promoteTier(before, {
			tier: "tier-1",
			metadata: before.metadata,
			estimatedReadTime: 0,
			contentFetchedAt: "2026-05-12T12:00:00.000Z",
			canonicalChanged: false,
		});

		assert.deepEqual(effects, [
			{ kind: "generate-summary", url: URL },
			{ kind: "publish-crawl-article-completed", url: URL },
		]);
	});

	it("emits publish-link-saved for an authenticated save when the canonical tier flipped", () => {
		const before = buildArticle({ url: URL });

		const { effects } = promoteTier(before, {
			tier: "tier-1",
			metadata: before.metadata,
			estimatedReadTime: 0,
			contentFetchedAt: "2026-05-12T12:00:00.000Z",
			canonicalChanged: true,
			userId: "user-123",
		});

		const userEvent = effects.find(
			(e): e is Extract<Effect, { kind: "publish-link-saved" }> =>
				e.kind === "publish-link-saved",
		);
		assert.ok(userEvent, "must publish-link-saved when userId is supplied");
		assert.equal(userEvent.userId, "user-123");
		assert.equal(userEvent.url, URL);
	});

	it("emits publish-anonymous-link-saved when no userId is supplied and the canonical changed", () => {
		const before = buildArticle({ url: URL });

		const { effects } = promoteTier(before, {
			tier: "tier-0",
			metadata: before.metadata,
			estimatedReadTime: 0,
			contentFetchedAt: "2026-05-12T12:00:00.000Z",
			canonicalChanged: true,
		});

		const anonEvent = effects.find(
			(e): e is Extract<Effect, { kind: "publish-anonymous-link-saved" }> =>
				e.kind === "publish-anonymous-link-saved",
		);
		assert.ok(anonEvent, "must publish-anonymous-link-saved without userId");
		assert.equal(anonEvent.url, URL);
	});

	it("suppresses publish-link-saved / publish-anonymous-link-saved when canonicalChanged is false", () => {
		const before = buildArticle({ url: URL });

		const { effects } = promoteTier(before, {
			tier: "tier-1",
			metadata: before.metadata,
			estimatedReadTime: 0,
			contentFetchedAt: "2026-05-12T12:00:00.000Z",
			canonicalChanged: false,
			userId: "user-123",
		});

		const hasSavedEvent = effects.some(
			(e) =>
				e.kind === "publish-link-saved" ||
				e.kind === "publish-anonymous-link-saved",
		);
		assert.equal(
			hasSavedEvent,
			false,
			"a re-pick of the same tier must not re-notify subscribers",
		);
	});

	it("does not mutate the input article", () => {
		const before = buildArticle();
		const snapshot = JSON.parse(JSON.stringify(before));

		promoteTier(before, {
			tier: "tier-1",
			metadata: { title: "x", siteName: "y", excerpt: "z", wordCount: 1 },
			estimatedReadTime: 1,
			contentFetchedAt: "2026-05-12T12:00:00.000Z",
			canonicalChanged: true,
			userId: "u",
		});

		assert.deepEqual(before, snapshot);
	});
});
