#!/usr/bin/env node
/**
 * Tier 1+ crawl pipeline health canary.
 *
 * Exercises the production crawling pipeline END-TO-END from a user's
 * perspective: force a re-crawl via `https://readplace.com/admin/recrawl/<url>`
 * and wait for the Lambda-driven worker to produce a parsed article. A
 * "failed" state or a missing expectedContent substring fails the run.
 *
 * Why this replaces the previous GH-Actions-local canary: the crawler can
 * behave differently from AWS Lambda's egress than from GitHub Actions'
 * egress (different IP reputation, different TLS fingerprint handling).
 * This test routes through prod's Lambda, so a "green" run means prod can
 * actually crawl the URL — not that GitHub Actions can.
 *
 * Auth: shared secret in `x-service-token` header, matched by require-admin
 * middleware against `RECRAWL_SERVICE_TOKEN`. No session cookie needed.
 *
 * Required env:
 *   - RECRAWL_SERVICE_TOKEN: the shared secret
 *   - READPLACE_ORIGIN (optional): override origin (defaults to prod)
 *
 * Run via: pnpm nx run @packages/crawl-article:tier-1-plus-pipeline-health
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { HEALTH_SOURCES } = require('./health-sources');

const ORIGIN = process.env.READPLACE_ORIGIN ?? 'https://readplace.com';
const SERVICE_TOKEN = process.env.RECRAWL_SERVICE_TOKEN;
if (!SERVICE_TOKEN) {
  throw new Error('RECRAWL_SERVICE_TOKEN env var is required');
}

// 3s poll interval × 60 polls = 180s budget per source. A successful
// Lambda cold start + crawl + parse + write lands well inside that.
// The upper bound also covers save-link's SQS retry → DLQ → terminal
// markCrawlFailed path, which takes ~90s on an origin that blocks the
// Lambda egress or a parser crash — both of which this canary MUST
// surface as a failing test, not a timeout.
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 180_000;

async function forceRecrawl(url) {
  const res = await fetch(`${ORIGIN}/admin/recrawl/${encodeURIComponent(url)}`, {
    headers: { 'x-service-token': SERVICE_TOKEN },
  });
  assert.equal(
    res.status,
    200,
    `force-recrawl ${url}: expected 200, got ${res.status} — URL may not be in the articles DB, or the service token was rejected.`,
  );
  await res.text();
}

function extractReaderStatus(html) {
  const match = html.match(/data-reader-status="([^"]*)"/);
  return match ? match[1] : undefined;
}

async function pollUntilDone(url) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let pollCount = 0;
  let lastStatus = 'unknown';
  let lastHtml = '';
  while (Date.now() < deadline) {
    const res = await fetch(
      `${ORIGIN}/admin/recrawl/reader?url=${encodeURIComponent(url)}&poll=${pollCount}`,
      {
        headers: { 'x-service-token': SERVICE_TOKEN },
      },
    );
    assert.equal(res.status, 200, `poll ${url}: expected 200, got ${res.status}`);
    lastHtml = await res.text();
    lastStatus = extractReaderStatus(lastHtml) ?? 'unknown';
    if (lastStatus === 'ready' || lastStatus === 'failed' || lastStatus === 'unavailable') {
      return { status: lastStatus, html: lastHtml };
    }
    pollCount += 1;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(
    `poll timed out for ${url} after ${POLL_TIMEOUT_MS}ms; last reader-status was '${lastStatus}'`,
  );
}

describe('Tier 1+ crawl pipeline health (via readplace.com/admin/recrawl)', () => {
  for (const source of HEALTH_SOURCES) {
    describe(source.label, () => {
      it('force recrawls via prod Lambda and the parsed article matches expected content', async () => {
        await forceRecrawl(source.url);
        const { status, html } = await pollUntilDone(source.url);
        assert.equal(
          status,
          'ready',
          `crawl ended in '${status}' for ${source.url} — the Lambda could not parse the URL (likely an origin-side block of the Lambda egress IP, or a parser regression).`,
        );
        assert(
          html.includes(source.expectedContent),
          `expected content "${source.expectedContent}" not found in parsed output for ${source.url}`,
        );
      });
    });
  }
});
