const path = require('path')
const config = require('../enforce-coverage.config')

config.enforceCoverage({
  projectRoot: path.resolve(__dirname, '..'),
  thresholds: config.thresholds,
  extraExcludePatterns: config.extraExcludePatterns,
})
