import assert from 'node:assert'
import express from 'express'
import { HutchLogger, consoleLogger } from '@packages/hutch-logger'
import { createTestApp } from '../runtime/test-app'
import { initInMemoryArticleStore } from '../runtime/providers/article-store/in-memory-article-store'
import { initRefreshArticleIfStale } from '../runtime/providers/article-freshness/check-content-freshness'
import { initFetchHtml, initFetchHtmlWithHeaders } from '../runtime/providers/article-parser/fetch-html'
import { initFetchConditional } from '../runtime/providers/article-parser/fetch-conditional'
import { initReadabilityParser, parseHtml } from '../runtime/providers/article-parser/readability-parser'
import { initInMemoryRefreshArticleContent } from '../runtime/providers/events/in-memory-refresh-article-content'
import { initInMemoryUpdateFetchTimestamp } from '../runtime/providers/events/in-memory-update-fetch-timestamp'

assert(process.env.E2E_PORT, "E2E_PORT is required")
const PORT = Number(process.env.E2E_PORT)
const origin = `http://localhost:${PORT}`
const logger = HutchLogger.from(consoleLogger)

const logError = (message: string, error?: Error) => console.error(JSON.stringify({ level: "ERROR", timestamp: new Date().toISOString(), message, stack: error?.stack }))
const fetchHtml = initFetchHtml({ fetch: globalThis.fetch, logError })
const fetchHtmlWithHeaders = initFetchHtmlWithHeaders({ fetch: globalThis.fetch, logError })
const fetchConditional = initFetchConditional({ fetch: globalThis.fetch })
const { parseArticle } = initReadabilityParser({ fetchHtml })

// Wire real refresh stack with in-memory publishers so e2e exercises the
// event-driven refresh/update-timestamp paths (publishRefreshArticleContent
// and publishUpdateFetchTimestamp) end-to-end.
const articleStore = initInMemoryArticleStore()
const { publishRefreshArticleContent } = initInMemoryRefreshArticleContent({ logger })
const { publishUpdateFetchTimestamp } = initInMemoryUpdateFetchTimestamp({ logger })
const { refreshArticleIfStale } = initRefreshArticleIfStale({
  findArticleFreshness: articleStore.findArticleFreshness,
  fetchConditional,
  fetchHtmlWithHeaders,
  parseHtml,
  publishRefreshArticleContent,
  publishUpdateFetchTimestamp,
  logError,
  now: () => new Date(),
  staleTtlMs: 0,
})

const { app: hutchApp, email } = createTestApp({
  articleStore,
  parseArticle,
  refreshArticleIfStale,
  publishUpdateFetchTimestamp,
  appOrigin: origin,
})

const server = express()

// Expose sent emails for E2E tests (password reset flow needs the reset token from email)
server.get('/e2e/sent-emails', (_req, res) => {
  res.json(email.getSentEmails())
})

server.use(hutchApp)

// Graceful shutdown so V8 writes coverage data to NODE_V8_COVERAGE directory
process.on('SIGTERM', () => process.exit(0))
process.on('SIGINT', () => process.exit(0))

server.listen(PORT, () => {
  logger.info(`E2E server running on http://localhost:${PORT}`)
})
