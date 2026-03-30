/**
 * Base Coverage Enforcement Configuration
 *
 * This module exists because c8's built-in coverage checking (`c8 check-coverage`)
 * doesn't work properly with Playwright. When running coverage with Playwright tests,
 * c8 generates the coverage data correctly but fails to enforce thresholds, allowing
 * tests to pass even when coverage is below the configured thresholds.
 *
 * Additionally, c8's include/exclude options only affect the terminal reporter display,
 * not the JSON summary totals. The coverage-summary.json includes ALL collected files,
 * causing percentages to differ from what's shown in the terminal.
 *
 * Observed in: c8@10.1.3
 * Related issue: https://github.com/bcoe/c8/issues/204
 *   "include/exclude only affect reporting, not collection"
 *
 * This module:
 * 1. Provides shared exclude patterns and thresholds
 * 2. Exports an enforceCoverage function that projects call with optional overrides
 * 3. Reads coverage-summary.json, filters files, validates against thresholds
 * 4. Fails the build with exit code 1 when coverage is insufficient
 *
 * IMPORTANT: Do NOT use c8's include/exclude/thresholds options in .c8rc.json.
 * They don't work correctly with the JSON summary. Define all patterns here.
 */
const fs = require('fs')
const path = require('path')
const { minimatch } = require('minimatch')

// Coverage thresholds — aim for maximum coverage.
// Thresholds are set slightly below 100% because:
// - V8 coverage instrumentation quirks (function counting, ternary branches)
// See: https://github.com/bcoe/c8/issues/126, https://github.com/bcoe/c8/issues/204
const DEFAULT_THRESHOLDS = {
  statements: 100,
  branches: 100,
  functions: 100,
  lines: 100,
}

// Files to include in coverage
const INCLUDE_PATTERNS = ['src/**/*.ts']

// Base exclusion patterns shared across all projects
const BASE_EXCLUDE_PATTERNS = [
  // Browser code — runs in browser, not testable in Node.js coverage
  '**/*.client.js',
  '**/*.browser.ts',

  // Type definitions — no runtime code to cover
  '**/*.types.ts',

  // Test files — c8's V8 coverage instrumentation doesn't work with Jest's worker model
  // See: https://github.com/bcoe/c8/issues/126 and https://github.com/jestjs/jest/issues/11188
  '**/*.test.ts',
  'src/**/*.integration.ts',

  // Test utilities — support files for tests, not production code
  '**/test-utils.ts',

  // Entry points — bootstrap code with no testable logic
  '**/*.main.ts',

  // Barrel re-exports — no logic, just re-export statements
  '**/index.ts',
]

function validateC8Config(projectRoot) {
  const c8ConfigPath = path.join(projectRoot, '.c8rc.json')
  if (!fs.existsSync(c8ConfigPath)) return

  const c8Config = JSON.parse(fs.readFileSync(c8ConfigPath, 'utf8'))
  const problematicKeys = ['include', 'exclude', 'thresholds'].filter(
    key => c8Config[key] !== undefined
  )

  if (problematicKeys.length > 0) {
    console.error('❌ ERROR: .c8rc.json contains unsupported options:', problematicKeys.join(', '))
    console.error('')
    console.error('c8 has a known issue where include/exclude options only affect reporting,')
    console.error('not the JSON summary totals. This causes coverage percentages to differ')
    console.error('between terminal output and coverage-summary.json.')
    console.error('')
    console.error('Observed in: c8@10.1.3')
    console.error('')
    console.error('Example of the problem:')
    console.error('  Terminal output: 100% coverage (filters applied to display)')
    console.error('  JSON summary:    85% coverage (totals include ALL collected files)')
    console.error('')
    console.error('Solution: Remove these options from .c8rc.json and define them in')
    console.error('scripts/enforce-coverage.js instead. This script handles filtering correctly.')
    console.error('')
    console.error('Related issue: https://github.com/bcoe/c8/issues/204')
    console.error('  "include/exclude only affect reporting, not collection"')
    process.exit(1)
  }
}

// c8 with source-map should report original TS paths, but handle
// dist/ paths as fallback (map back to src/)
function toRelativePath(filePath) {
  let relativePath = path.relative(process.cwd(), filePath)
  if (relativePath.startsWith('dist/')) {
    relativePath = relativePath.replace(/^dist\//, 'src/')
    if (!relativePath.endsWith('.client.js')) {
      relativePath = relativePath.replace(/\.js$/, '.ts')
    }
  }
  return relativePath
}

const METRICS = ['statements', 'branches', 'functions', 'lines']

function shouldIncludeFile(filePath, includePatterns, excludePatterns) {
  const relativePath = toRelativePath(filePath)

  const included = includePatterns.some(pattern =>
    minimatch(relativePath, pattern, { dot: true })
  )
  if (!included) return false

  const excluded = excludePatterns.some(pattern =>
    minimatch(relativePath, pattern, { dot: true })
  )
  return !excluded
}

function getIncludedFiles(coverage, includePatterns, excludePatterns) {
  const files = []
  for (const [filePath, data] of Object.entries(coverage)) {
    if (filePath === 'total') continue
    if (!shouldIncludeFile(filePath, includePatterns, excludePatterns)) continue
    files.push({ filePath, data })
  }
  return files
}

function calculateTotals(includedFiles) {
  const totals = {
    statements: { total: 0, covered: 0 },
    branches: { total: 0, covered: 0 },
    functions: { total: 0, covered: 0 },
    lines: { total: 0, covered: 0 },
  }

  for (const { data } of includedFiles) {
    for (const metric of METRICS) {
      totals[metric].total += data[metric].total
      totals[metric].covered += data[metric].covered
    }
  }

  const result = {}
  for (const metric of METRICS) {
    const { total, covered } = totals[metric]
    result[metric] = { pct: total > 0 ? (covered / total) * 100 : 100 }
  }
  return result
}

function isFullyCovered(fileData) {
  return METRICS.every(m => fileData[m].total === 0 || fileData[m].pct === 100)
}

function hasC8IgnoreComment(filePath, projectRoot) {
  const relativePath = toRelativePath(filePath)
  const sourcePath = path.join(projectRoot, relativePath)
  try {
    const content = fs.readFileSync(sourcePath, 'utf8')
    return /\/\*\s*c8 ignore|\/\/\s*c8 ignore|\/\*\s*istanbul ignore|\/\/\s*istanbul ignore/.test(content)
  } catch {
    return false
  }
}

function printFileReport(includedFiles, projectRoot) {
  const fullyCovered = []
  const partiallyCovered = []

  for (const { filePath, data } of includedFiles) {
    const relativePath = toRelativePath(filePath)
    if (isFullyCovered(data)) {
      fullyCovered.push(relativePath)
    } else {
      const hasIgnore = hasC8IgnoreComment(filePath, projectRoot)
      partiallyCovered.push({ relativePath, data, hasIgnore })
    }
  }

  partiallyCovered.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
  fullyCovered.sort()

  if (partiallyCovered.length > 0) {
    console.log('\n📋 Files With Incomplete Coverage')
    console.log('─'.repeat(100))
    console.log(
      'File'.padEnd(60) +
      'Stmts'.padStart(8) +
      'Branch'.padStart(8) +
      'Funcs'.padStart(8) +
      'Lines'.padStart(8) +
      '  Note'
    )
    console.log('─'.repeat(100))

    for (const { relativePath, data, hasIgnore } of partiallyCovered) {
      const stmts = data.statements.pct.toFixed(1).padStart(7) + '%'
      const branch = data.branches.pct.toFixed(1).padStart(7) + '%'
      const funcs = data.functions.pct.toFixed(1).padStart(7) + '%'
      const lines = data.lines.pct.toFixed(1).padStart(7) + '%'
      const note = hasIgnore ? '  has c8 ignore' : ''
      console.log(relativePath.padEnd(60) + stmts + branch + funcs + lines + note)
    }

    console.log('─'.repeat(100))
  }

  console.log(`\n✅ ${fullyCovered.length} file(s) at 100% coverage`)
  if (partiallyCovered.length > 0) {
    console.log(`⚠️  ${partiallyCovered.length} file(s) with incomplete coverage`)
  }
}

/**
 * Enforce coverage thresholds.
 *
 * @param {Object} options
 * @param {string} options.projectRoot - Absolute path to the project directory
 * @param {Object} [options.thresholds] - Override default thresholds
 * @param {string[]} [options.extraExcludePatterns] - Additional exclude patterns beyond base
 */
function enforceCoverage(options = {}) {
  const {
    projectRoot = process.cwd(),
    thresholds = DEFAULT_THRESHOLDS,
    extraExcludePatterns = [],
  } = options

  const excludePatterns = [...BASE_EXCLUDE_PATTERNS, ...extraExcludePatterns]

  console.log('🎯 Enforcing Coverage Thresholds')
  console.log('================================')

  try {
    validateC8Config(projectRoot)

    const coverageFile = path.join(projectRoot, 'coverage/coverage-summary.json')
    if (!fs.existsSync(coverageFile)) {
      console.error('❌ No coverage summary found. Run tests first.')
      process.exit(1)
    }

    const coverage = JSON.parse(fs.readFileSync(coverageFile, 'utf8'))
    const includedFiles = getIncludedFiles(coverage, INCLUDE_PATTERNS, excludePatterns)
    const totals = calculateTotals(includedFiles)

    printFileReport(includedFiles, projectRoot)

    console.log('\n📊 Aggregate Thresholds')
    console.log('================================')

    let failed = false
    const results = []

    Object.entries(thresholds).forEach(([metric, threshold]) => {
      const actual = totals[metric]?.pct
      if (actual === undefined) {
        console.error(`❌ Metric '${metric}' not found in coverage data`)
        failed = true
        return
      }

      const actualRounded = Number(actual.toFixed(2))
      const status = actualRounded >= threshold ? '✅' : '❌'
      const message = `${status} ${metric}: ${actualRounded}% (threshold: ${threshold}%)`

      console.log(message)
      results.push({ metric, actual: actualRounded, threshold, passed: actualRounded >= threshold })

      if (actualRounded < threshold) {
        failed = true
      }
    })

    if (failed) {
      console.log('\n🚨 COVERAGE THRESHOLD FAILURE')
      console.log('==============================')

      results.forEach(({ metric, actual, threshold, passed }) => {
        if (!passed) {
          const gap = (threshold - actual).toFixed(2)
          console.log(`❌ ${metric}: ${actual}% < ${threshold}% (gap: ${gap}%)`)
        }
      })

      console.log('\n💡 Fix by:')
      console.log('   1. Adding tests for uncovered lines')
      console.log('   2. Removing dead code')
      process.exit(1)
    } else {
      console.log('\n🎉 ALL COVERAGE THRESHOLDS MET!')
    }
  } catch (error) {
    console.error('❌ Error reading coverage data:', error.message)
    process.exit(1)
  }
}

module.exports = {
  DEFAULT_THRESHOLDS,
  INCLUDE_PATTERNS,
  BASE_EXCLUDE_PATTERNS,
  enforceCoverage,
}
