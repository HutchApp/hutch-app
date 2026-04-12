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
 * Run via: pnpm nx run save-link:check-sources
 * (depends on the `compile` target — see project.json)
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_CRAWL_HEADERS, initCrawlArticle } = require('../dist/article-parser/crawl-article');
const { HEALTH_SOURCES } = require('./health-sources');

const MIN_HTML_BYTES = 2000;

const crawlArticle = initCrawlArticle({
  fetch: globalThis.fetch,
  logError: (message, error) => console.error(message, error ?? ''),
  headers: { ...DEFAULT_CRAWL_HEADERS },
});

function assertFetched(result, url) {
  assert.equal(
    result.status,
    'fetched',
    `expected 'fetched' for ${url}, got '${result.status}' — likely 403 or network error`,
  );
  assert(
    result.html.length > MIN_HTML_BYTES,
    `HTML too short (${result.html.length} bytes) for ${url} — likely a block or paywall page`,
  );
  assert(
    result.html.toLowerCase().includes('<html'),
    `response for ${url} does not look like HTML`,
  );
}

describe('crawler source health', () => {
  for (const source of HEALTH_SOURCES) {
    describe(source.label, () => {
      it('first save fetch (no conditional headers)', async () => {
        const result = await crawlArticle({ url: source.url });
        assertFetched(result, source.url);
      });

      it('TTL refresh fetch (replays etag / lastModified from first save)', async () => {
        // Re-fetch the same source to capture its current etag/last-modified,
        // then send a second request with those as conditional headers.
        // Servers that support conditional requests return 304 (not-modified);
        // servers that don't return 200 (fetched). Both are acceptable — the
        // failure mode we're guarding against is `status: 'failed'`.
        const firstResult = await crawlArticle({ url: source.url });
        assertFetched(firstResult, source.url);

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
            refreshResult.html.length > MIN_HTML_BYTES,
            `TTL refresh HTML too short (${refreshResult.html.length} bytes) for ${source.url}`,
          );
        }
      });
    });
  }
});
