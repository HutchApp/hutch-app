import assert from "node:assert/strict";
import type { Article, ArticleMetadata } from "../article.types";
import {
	recrawlPromoteTier,
	type RecrawlPromoteTierInput,
} from "./recrawl-promote-tier";

function buildArticle(overrides: Partial<Article> = {}): Article {
	return {
		url: "https://example.com/article",
		metadata: {
			title: "Old title",
			siteName: "example.com",
			excerpt: "Old excerpt",
			wordCount: 100,
		},
		freshness: { contentFetchedAt: "2026-01-01T00:00:00.000Z" },
		estimatedReadTime: 1,
		crawl: { kind: "pending" },
		summary: { kind: "ready", summary: "old" },
		...overrides,
	};
}

function buildInput(
	overrides: Partial<RecrawlPromoteTierInput> = {},
): RecrawlPromoteTierInput {
	return {
		winnerTier: "tier-1",
		metadata: {
			title: "New title",
			siteName: "example.com",
			excerpt: "New excerpt",
			wordCount: 250,
		} satisfies ArticleMetadata,
		estimatedReadTime: 2,
		contentFetchedAt: "2026-05-12T12:00:00.000Z",
		...overrides,
	};
}

describe("recrawlPromoteTier", () => {
	it("flips crawl to ready and refreshes metadata, freshness, estimatedReadTime, and summary state in one transition", () => {
		const { article } = recrawlPromoteTier(buildArticle(), buildInput());

		assert.deepEqual(article.crawl, { kind: "ready" });
		assert.equal(article.metadata.title, "New title");
		assert.equal(article.metadata.wordCount, 250);
		assert.equal(article.estimatedReadTime, 2);
		assert.equal(article.freshness.contentFetchedAt, "2026-05-12T12:00:00.000Z");
		assert.deepEqual(article.summary, { kind: "pending" });
	});

	it("emits generate-summary and publish-recrawl-completed effects in that order", () => {
		const { effects } = recrawlPromoteTier(
			buildArticle({ url: "https://example.com/post" }),
			buildInput({ winnerTier: "tier-0" }),
		);

		assert.deepEqual(effects, [
			{ kind: "generate-summary", url: "https://example.com/post" },
			{ kind: "publish-recrawl-completed", url: "https://example.com/post" },
		]);
	});

	it("declares writes for all four axes — the canonical S3 copy and contentLocation columns are owned by writeCanonicalContent outside the aggregate", () => {
		const { writes } = recrawlPromoteTier(buildArticle(), buildInput());

		assert.deepEqual(
			[...writes].sort(),
			["crawl", "freshness", "metadata", "summary"],
		);
	});

	it("does not mutate the input article (pure function)", () => {
		const before = buildArticle();
		const snapshot = JSON.parse(JSON.stringify(before));

		recrawlPromoteTier(before, buildInput());

		assert.deepEqual(before, snapshot);
	});

	it("produces the same aggregate state regardless of which tier won (sibling-transition contract)", () => {
		const tier0 = recrawlPromoteTier(
			buildArticle(),
			buildInput({ winnerTier: "tier-0" }),
		);
		const tier1 = recrawlPromoteTier(
			buildArticle(),
			buildInput({ winnerTier: "tier-1" }),
		);

		assert.deepEqual(tier0.article, tier1.article);
		assert.deepEqual(tier0.effects, tier1.effects);
		assert.deepEqual(tier0.writes, tier1.writes);
	});

	it("exposes its function name so transitionAndPersist can tag the row for the canary measurement", () => {
		assert.equal(recrawlPromoteTier.name, "recrawlPromoteTier");
	});
});
