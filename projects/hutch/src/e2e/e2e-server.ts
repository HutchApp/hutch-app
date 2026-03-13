import { HutchLogger, consoleLogger } from 'hutch-logger'
import { createHutchApp } from '../runtime/app'
import { fetchHtml } from '../runtime/providers/article-parser/fetch-html'
import { initReadabilityParser } from '../runtime/providers/article-parser/readability-parser'

const PORT = 3100
const logger = HutchLogger.from(consoleLogger)

const { parseArticle } = initReadabilityParser({ fetchHtml })
const { app } = createHutchApp({ parseArticle, appOrigin: `http://localhost:${PORT}` })

// Graceful shutdown so V8 writes coverage data to NODE_V8_COVERAGE directory
process.on('SIGTERM', () => process.exit(0))
process.on('SIGINT', () => process.exit(0))

app.listen(PORT, () => {
  logger.info(`E2E server running on http://localhost:${PORT}`)
})
