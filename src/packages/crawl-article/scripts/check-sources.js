#!/usr/bin/env node
/**
 * Real-network canary for the article crawler.
 *
 * Exercises the compiled production `initCrawlArticle` against a list of
 * known-good sources (see ./health-sources.js). For each source, runs TWO
 * calls:
 *   1. First-time save fetch (no If-None-Match / If-Modified-Since)
 *   2. TTL refresh fetch, replaying the etag / Last-Modified from (1)
 *
 * Both code paths matter: a Fastly/Cloudflare edge sniffer can block the
 * regular fetch (Medium 403), and a server can misbehave on conditional
 * requests. The canary proves both still work. Per-source failures show
 * in the GitHub Actions UI as `✗ <label> > (first save | TTL refresh)`.
 *
 * Run via: pnpm nx run @packages/crawl-article:check-sources
 * (depends on the `compile` target — see project.json)
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_CRAWL_HEADERS, initCrawlArticle } = require('../dist/crawl-article');
const { HEALTH_SOURCES } = require('./health-sources');

const crawlArticle = initCrawlArticle({
  fetch: globalThis.fetch,
  logError: (message, error) => console.error(message, error ?? ''),
  headers: { ...DEFAULT_CRAWL_HEADERS },
});

function assertFetched(result, source) {
  assert.equal(
    result.status,
    'fetched',
    `expected 'fetched' for ${source.url}, got '${result.status}' — likely 403 or network error`,
  );
  assert(
    result.html.toLowerCase().includes('<html'),
    `response for ${source.url} does not look like HTML`,
  );
  assert(
    result.html.includes(source.expectedContent),
    `expected content not found for ${source.url} — got a block/error page instead of real article content`,
  );
}

describe('crawler source health', () => {
  for (const source of HEALTH_SOURCES) {
    describe(source.label, () => {
      it('first save fetch (no conditional headers)', async () => {
        const result = await crawlArticle({ url: source.url });
        assertFetched(result, source);
      });

      it('TTL refresh fetch (replays etag / lastModified from first save)', async () => {
        // Re-fetch the same source to capture its current etag/last-modified,
        // then send a second request with those as conditional headers.
        // Servers that support conditional requests return 304 (not-modified);
        // servers that don't return 200 (fetched). Both are acceptable — the
        // failure mode we're guarding against is `status: 'failed'`.
        const firstResult = await crawlArticle({ url: source.url });
        assertFetched(firstResult, source);

        const refreshResult = await crawlArticle({
          url: source.url,
          etag: firstResult.etag,
          lastModified: firstResult.lastModified,
        });

        assert(
          refreshResult.status === 'not-modified' || refreshResult.status === 'fetched',
          `TTL refresh for ${source.url} returned '${refreshResult.status}' — expected 'not-modified' or 'fetched'`,
        );
        if (refreshResult.status === 'fetched') {
          assert(
            refreshResult.html.includes(source.expectedContent),
            `TTL refresh expected content not found for ${source.url} — got a block/error page instead of real article content`,
          );
        }
      });
    });
  }
});
