/* c8 ignore start -- composition root, no logic to test */
import assert from 'node:assert'
import express from 'express'
import { HutchLogger, consoleLogger } from '@packages/hutch-logger'
import { createTestApp } from '../runtime/test-app'
import { initFetchHtml } from '../runtime/providers/article-parser/fetch-html'
import { initReadabilityParser } from '../runtime/providers/article-parser/readability-parser'

assert(process.env.E2E_PORT, "E2E_PORT is required")
const PORT = Number(process.env.E2E_PORT)
const origin = `http://localhost:${PORT}`
const logger = HutchLogger.from(consoleLogger)

const logError = (message: string, error?: Error) => console.error(JSON.stringify({ level: "ERROR", timestamp: new Date().toISOString(), message, stack: error?.stack }))
const fetchHtml = initFetchHtml({ fetch: globalThis.fetch, logError })
const { parseArticle } = initReadabilityParser({ fetchHtml })
const { app: hutchApp, email } = createTestApp({ parseArticle, appOrigin: origin })

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
/* c8 ignore stop */
