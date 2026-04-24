import express from 'express'
import { HutchLogger, consoleLogger } from '@packages/hutch-logger'
import { createTestApp } from '../runtime/test-app'
import {
  createFakeApplyParseResult,
  createFakePublishLinkSaved,
  createFakePublishSaveAnonymousLink,
  createFakeSummaryProvider,
  defaultHttpErrorMessageMapping,
  initReadabilityParser,
} from '../runtime/test-app-fakes'
import { requireEnv } from '../runtime/require-env'
import { initInMemoryArticleCrawl } from '../runtime/providers/article-crawl/in-memory-article-crawl'
import { initInMemoryArticleStore } from '../runtime/providers/article-store/in-memory-article-store'
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

// Wire real refresh stack with in-memory publishers so e2e exercises the
// event-driven refresh/update-timestamp paths (publishRefreshArticleContent
// and publishUpdateFetchTimestamp) end-to-end.
const articleStore = initInMemoryArticleStore()
const articleCrawl = initInMemoryArticleCrawl()
const { publishRefreshArticleContent } = initInMemoryRefreshArticleContent({ logger })
const { publishUpdateFetchTimestamp } = initInMemoryUpdateFetchTimestamp({ logger })
const { refreshArticleIfStale } = initRefreshArticleIfStale({
  findArticleFreshness: articleStore.findArticleFreshness,
  crawlArticle,
  parseHtml,
  publishRefreshArticleContent,
  publishUpdateFetchTimestamp,
  now: () => new Date(),
  staleTtlMs: 0,
})

const applyParseResult = createFakeApplyParseResult({ articleStore, articleCrawl, parseArticle })
const summary = createFakeSummaryProvider()

const { app: hutchApp, email } = createTestApp({
  articleStore,
  articleCrawl,
  parseArticle,
  crawlArticle,
  publishLinkSaved: createFakePublishLinkSaved(applyParseResult),
  publishSaveAnonymousLink: createFakePublishSaveAnonymousLink(applyParseResult),
  publishUpdateFetchTimestamp,
  findGeneratedSummary: summary.findGeneratedSummary,
  markSummaryPending: summary.markSummaryPending,
  findArticleCrawlStatus: articleCrawl.findArticleCrawlStatus,
  markCrawlPending: articleCrawl.markCrawlPending,
  refreshArticleIfStale,
  httpErrorMessageMapping: defaultHttpErrorMessageMapping,
  exchangeGoogleCode: undefined,
  logError,
  appOrigin: origin,
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
