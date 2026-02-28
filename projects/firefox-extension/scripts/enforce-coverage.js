const { enforceCoverage } = require('../../../enforce-coverage.config.base')
const config = require('../enforce-coverage.config')
const path = require('path')

enforceCoverage({
  projectRoot: path.resolve(__dirname, '..'),
  thresholds: config.thresholds,
  extraExcludePatterns: config.extraExcludePatterns,
})
