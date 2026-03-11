import express from 'express'
import type { Request, Response, NextFunction } from 'express'
import { consoleLogger } from 'hutch-logger'
import { createApp } from '../runtime/server'
import { initInMemoryAuth } from '../runtime/providers/auth/in-memory-auth'
import { initInMemoryArticleStore } from '../runtime/providers/article-store/in-memory-article-store'
import { createOAuthModel, initInMemoryOAuthModel } from '../runtime/providers/oauth/oauth-model'
import { createValidateAccessToken } from '../runtime/providers/oauth/validate-access-token'
import type { ParseArticle } from '../runtime/providers/article-parser/article-parser.types'

const PORT = 3100

const STUB_ARTICLES: Record<string, { title: string; siteName: string; excerpt: string; wordCount: number; content: string }> = {
  'https://example.com/article-one': {
    title: 'Article One',
    siteName: 'example.com',
    excerpt: 'First test article excerpt.',
    wordCount: 500,
    content: '<p>Content of article one. This is the first article saved in the E2E test.</p>',
  },
  'https://example.com/article-two': {
    title: 'Article Two',
    siteName: 'example.com',
    excerpt: 'Second test article excerpt.',
    wordCount: 1000,
    content: '<p>Content of article two. This is the second article saved in the E2E test.</p>',
  },
  'https://example.com/article-three': {
    title: 'Article Three',
    siteName: 'example.com',
    excerpt: 'Third test article excerpt.',
    wordCount: 1500,
    content: '<p>Content of article three. This is the third article saved in the E2E test.</p>',
  },
  'https://example.com/article-four': {
    title: 'Article Four',
    siteName: 'example.com',
    excerpt: 'Fourth test article excerpt.',
    wordCount: 2000,
    content: '<p>Content of article four. This is the fourth article saved in the E2E test.</p>',
  },
}

const parseArticle: ParseArticle = async (url) => {
  const stub = STUB_ARTICLES[url]
  if (!stub) return { ok: false, reason: 'Unknown test URL' }
  return { ok: true, article: stub }
}

const oauthModel = createOAuthModel(initInMemoryOAuthModel())

const innerApp = createApp({
  ...initInMemoryAuth(),
  ...initInMemoryArticleStore(),
  parseArticle,
  oauthModel,
  validateAccessToken: createValidateAccessToken(oauthModel),
})

// Wrap the app to strip the Origin header for same-origin requests.
// The production CORS middleware only allows browser extension origins,
// which blocks regular form POSTs from Chromium (it sends Origin on POST).
const app = express()
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.headers.origin === `http://localhost:${PORT}`) {
    delete req.headers.origin
  }
  next()
})
app.use(innerApp)

// Graceful shutdown so V8 writes coverage data to NODE_V8_COVERAGE directory
process.on('SIGTERM', () => process.exit(0))
process.on('SIGINT', () => process.exit(0))

app.listen(PORT, () => {
  consoleLogger.info(`E2E server running on http://localhost:${PORT}`)
})
