import express from 'express'
import type { Request, Response, NextFunction } from 'express'
import { createHutchApp } from '../runtime/app'

const PORT = 3100

const { app: innerApp } = createHutchApp()

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
  console.log(`E2E server running on http://localhost:${PORT}`)
})
