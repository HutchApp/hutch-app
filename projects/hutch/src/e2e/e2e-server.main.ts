import express from 'express'
import { HutchLogger, consoleLogger, noopLogger } from '@packages/hutch-logger'
import { createTestApp } from '../runtime/test-app'
import {
  createDefaultTestAppFixture,
  createFakeApplyParseResult,
  createFakePublishLinkSaved,
  createFakePublishRecrawlLinkInitiated,
  createFakePublishSaveAnonymousLink,
  createFakeSummaryProvider,
  initReadabilityParser,
} from '../runtime/test-app-fakes'
import { requireEnv } from '../runtime/require-env'
import { initRefreshArticleIfStale } from '../runtime/providers/article-freshness/check-content-freshness'
import { DEFAULT_CRAWL_HEADERS, initCrawlArticle } from '@packages/crawl-article'
import { theInformationPreParser } from '../runtime/providers/article-parser/the-information-pre-parser'
import { initInMemoryRefreshArticleContent } from '../runtime/providers/events/in-memory-refresh-article-content'
import { initInMemoryUpdateFetchTimestamp } from '../runtime/providers/events/in-memory-update-fetch-timestamp'

const PORT = Number(requireEnv('E2E_PORT'))
const origin = `http://localhost:${PORT}`
const logger = HutchLogger.from(consoleLogger)

const logError = (message: string, error?: Error) => console.error(JSON.stringify({ level: "ERROR", timestamp: new Date().toISOString(), message, stack: error?.stack }))
const crawlArticle = initCrawlArticle({ fetch: globalThis.fetch, logError, headers: { ...DEFAULT_CRAWL_HEADERS } })
const { parseArticle, parseHtml } = initReadabilityParser({ crawlArticle, sitePreParsers: [theInformationPreParser], logError })

const fixture = createDefaultTestAppFixture(origin)
// E2E exercises the HTMX polling UI end-to-end, so opt the summary fake into
// transitioning pending → ready after a few reads. Unit/route tests use the
// default (stays pending) for deterministic HTML assertions.
const summary = createFakeSummaryProvider({ readyAfterReads: 3 })

// Wire real refresh stack with in-memory publishers so e2e exercises the
// event-driven refresh/update-timestamp paths (publishRefreshArticleContent
// and publishUpdateFetchTimestamp) end-to-end. In CI, swap to noopLogger so
// per-request "in-memory no-op" lines don't flood the build log; locally keep
// the consoleLogger so the lines are visible for debugging.
const eventLogger = process.env.CI === 'true' ? noopLogger : logger
const { publishRefreshArticleContent } = initInMemoryRefreshArticleContent({ logger: eventLogger })
const { publishUpdateFetchTimestamp } = initInMemoryUpdateFetchTimestamp({ logger: eventLogger })
const { refreshArticleIfStale } = initRefreshArticleIfStale({
  findArticleFreshness: fixture.articleStore.findArticleFreshness,
  findArticleCrawlStatus: fixture.articleCrawl.findArticleCrawlStatus,
  crawlArticle,
  parseHtml,
  publishRefreshArticleContent,
  publishUpdateFetchTimestamp,
  now: () => new Date(),
  staleTtlMs: 0,
})

const applyParseResult = createFakeApplyParseResult({
  articleStore: fixture.articleStore,
  articleCrawl: fixture.articleCrawl,
  parseArticle,
})

const { app: hutchApp, email } = createTestApp({
  ...fixture,
  parser: { parseArticle, crawlArticle },
  events: {
    publishLinkSaved: createFakePublishLinkSaved(applyParseResult),
    publishRecrawlLinkInitiated: createFakePublishRecrawlLinkInitiated(applyParseResult),
    publishSaveAnonymousLink: createFakePublishSaveAnonymousLink(applyParseResult),
    publishSaveLinkRawHtmlCommand: fixture.events.publishSaveLinkRawHtmlCommand,
    publishUpdateFetchTimestamp,
  },
  freshness: { refreshArticleIfStale },
  summary,
  shared: {
    appOrigin: fixture.shared.appOrigin,
    httpErrorMessageMapping: fixture.shared.httpErrorMessageMapping,
    logError,
    logParseError: fixture.shared.logParseError,
  },
})

const server = express()

// Expose sent emails for E2E tests (password reset flow needs the reset token from email)
server.get('/e2e/sent-emails', (_req, res) => {
  res.json(email.getSentEmails())
})

// Deterministic crawl-failure fixture: any GET returns 500 so tests can exercise
// the reader-failed / summary-hidden flow against a URL that's guaranteed to
// fail regardless of network conditions.
server.get('/e2e/unfetchable', (_req, res) => {
  res.status(500).type('text/plain').send('e2e: intentional crawl failure')
})

server.use(hutchApp)

// Graceful shutdown so V8 writes coverage data to NODE_V8_COVERAGE directory
process.on('SIGTERM', () => process.exit(0))
process.on('SIGINT', () => process.exit(0))

server.listen(PORT, () => {
  logger.info(`E2E server running on http://localhost:${PORT}`)
})
