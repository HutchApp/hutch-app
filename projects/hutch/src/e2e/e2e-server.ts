import { createHutchApp } from '../runtime/app'

const PORT = 3100

const { app } = createHutchApp({ appOrigin: `http://localhost:${PORT}` })

// Graceful shutdown so V8 writes coverage data to NODE_V8_COVERAGE directory
process.on('SIGTERM', () => process.exit(0))
process.on('SIGINT', () => process.exit(0))

app.listen(PORT, () => {
  console.log(`E2E server running on http://localhost:${PORT}`)
})
