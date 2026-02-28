/**
 * Unused CSS Detection Script
 *
 * This script uses PurgeCSS to detect CSS classes defined in stylesheets that
 * are not used in any HTML template, client-side JavaScript, or TypeScript file.
 *
 * Similar to how Knip detects unused exports, this script ensures CSS stays
 * in sync with the codebase by failing the lint check when unused classes exist.
 *
 * Inline exclusions:
 *   Use purgecss-ignore comments in CSS files to exclude selectors.
 *
 *   Single selector (comment on line before):
 *     [purgecss-ignore: reason]
 *     .my-dynamic-class { color: red; }
 *
 *   Block of selectors:
 *     [purgecss-ignore-start: reason]
 *     .library-class { ... }
 *     .another-class { ... }
 *     [purgecss-ignore-end]
 *
 *   (Use CSS comment syntax in actual files)
 *
 * Usage:
 *   node scripts/check-unused-css.js
 *
 * Exit codes:
 *   0 - All CSS classes are used
 *   1 - Unused CSS classes found (or error occurred)
 */
const { PurgeCSS } = require('purgecss');
const path = require('path');
const fs = require('fs');

/**
 * Extracts class selectors from a CSS line.
 *
 * @param {string} line - CSS line to parse
 * @returns {string[]} Array of class selectors found
 */
function extractClassSelectors(line) {
  const selectors = [];
  const selectorPart = line.split('{')[0];

  // Split by comma to handle grouped selectors
  const parts = selectorPart.split(',');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith('.')) {
      const classMatch = trimmed.match(/^\.[a-zA-Z_-][a-zA-Z0-9_-]*/);
      if (classMatch) {
        selectors.push(classMatch[0]);
      }
    }
  }

  return selectors;
}

/**
 * Parses a CSS file for purgecss-ignore comments and extracts the selectors
 * that should be ignored.
 *
 * Supports two comment styles:
 * - Single: purgecss-ignore: reason (ignores next selector)
 * - Block: purgecss-ignore-start: reason ... purgecss-ignore-end (ignores all selectors in block)
 *
 * @param {string} filePath - Path to the CSS file
 * @returns {Set<string>} Set of selectors to ignore
 */
function parseInlineIgnores(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const ignoredSelectors = new Set();
  const lines = content.split('\n');

  let inIgnoreBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check for block start
    if (line.startsWith('/* purgecss-ignore-start:') && line.endsWith('*/')) {
      inIgnoreBlock = true;
      continue;
    }

    // Check for block end
    if (line === '/* purgecss-ignore-end */') {
      inIgnoreBlock = false;
      continue;
    }

    // Inside ignore block - extract all class selectors
    if (inIgnoreBlock) {
      for (const selector of extractClassSelectors(line)) {
        ignoredSelectors.add(selector);
      }
      continue;
    }

    // Check for single-line ignore comment
    if (line.startsWith('/* purgecss-ignore:') && line.endsWith('*/')) {
      // Look for selectors on subsequent lines until we hit an opening brace
      for (let j = i + 1; j < lines.length; j++) {
        const selectorLine = lines[j].trim();
        if (!selectorLine || selectorLine.startsWith('/*')) continue;

        for (const selector of extractClassSelectors(selectorLine)) {
          ignoredSelectors.add(selector);
        }

        // Stop after finding the first selector line with content
        if (selectorLine.includes('{') || !selectorLine.startsWith('/*')) {
          break;
        }
      }
    }
  }

  return ignoredSelectors;
}

/**
 * Cache for inline-ignored selectors by file path.
 * @type {Map<string, Set<string>>}
 */
const inlineIgnoreCache = new Map();

/**
 * Gets the inline-ignored selectors for a file, using cache.
 *
 * @param {string} filePath - Path to the CSS file
 * @returns {Set<string>} Set of ignored selectors
 */
function getInlineIgnores(filePath) {
  if (!inlineIgnoreCache.has(filePath)) {
    inlineIgnoreCache.set(filePath, parseInlineIgnores(filePath));
  }
  return inlineIgnoreCache.get(filePath);
}

async function checkUnusedCss() {
  console.log('🔍 Checking for unused CSS classes');
  console.log('===================================\n');

  try {
    const configPath = path.join(__dirname, '../purgecss.config.js');
    const config = require(configPath);

    const purgeCSSResult = await new PurgeCSS().purge({
      ...config,
      // Enable rejected output to get unused selectors
      rejected: true,
    });

    let hasUnusedClasses = false;
    const unusedByFile = [];

    for (const result of purgeCSSResult) {
      const rejected = result.rejected || [];
      if (rejected.length === 0) continue;

      // Get inline-ignored selectors for this specific file
      const inlineIgnored = getInlineIgnores(result.file);

      // Filter to only class selectors (starting with .)
      // Exclude pseudo-classes, attribute selectors, and element selectors
      // Also exclude inline-ignored selectors
      const unusedClasses = rejected.filter(selector => {
        // Only keep simple class selectors: .class-name
        // Exclude: .class:hover, .class::before, .class[attr], element.class, etc.
        if (!/^\.[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(selector)) {
          return false;
        }
        // Exclude selectors marked with purgecss-ignore comments
        if (inlineIgnored.has(selector)) {
          return false;
        }
        return true;
      });

      if (unusedClasses.length === 0) continue;

      hasUnusedClasses = true;
      const relativePath = path.relative(process.cwd(), result.file);
      unusedByFile.push({ file: relativePath, classes: unusedClasses });
    }

    if (hasUnusedClasses) {
      console.log('❌ UNUSED CSS CLASSES FOUND\n');

      for (const { file, classes } of unusedByFile) {
        console.log(`📄 ${file}`);
        for (const cls of classes) {
          console.log(`   ${cls}`);
        }
        console.log('');
      }

      console.log('💡 Fix by:');
      console.log('   1. Using the class in an HTML template or component');
      console.log('   2. Removing the unused class from the CSS file');
      console.log('   3. Adding /* purgecss-ignore: reason */ comment above the selector\n');

      process.exit(1);
    }

    console.log('✅ All CSS classes are in use\n');
  } catch (error) {
    console.error('❌ Error checking unused CSS:', error.message);
    process.exit(1);
  }
}

checkUnusedCss();
