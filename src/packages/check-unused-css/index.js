/**
 * Unused CSS Detection
 *
 * Detects CSS classes defined in stylesheets that are not used in any
 * HTML template, client-side JavaScript, or TypeScript file using PurgeCSS.
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
 * Exit codes:
 *   0 - All CSS classes are used
 *   1 - Unused CSS classes found (or error occurred)
 */
const { PurgeCSS } = require('purgecss');
const path = require('path');
const fs = require('fs');

/**
 * @param {string} line - CSS line to parse
 * @returns {string[]} Array of class selectors found
 */
function extractClassSelectors(line) {
  const selectors = [];
  const selectorPart = line.split('{')[0];

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

    if (line.startsWith('/* purgecss-ignore-start:') && line.endsWith('*/')) {
      inIgnoreBlock = true;
      continue;
    }

    if (line === '/* purgecss-ignore-end */') {
      inIgnoreBlock = false;
      continue;
    }

    if (inIgnoreBlock) {
      for (const selector of extractClassSelectors(line)) {
        ignoredSelectors.add(selector);
      }
      continue;
    }

    if (line.startsWith('/* purgecss-ignore:') && line.endsWith('*/')) {
      for (let j = i + 1; j < lines.length; j++) {
        const selectorLine = lines[j].trim();
        if (!selectorLine || selectorLine.startsWith('/*')) continue;

        for (const selector of extractClassSelectors(selectorLine)) {
          ignoredSelectors.add(selector);
        }

        if (selectorLine.includes('{') || !selectorLine.startsWith('/*')) {
          break;
        }
      }
    }
  }

  return ignoredSelectors;
}

/** @type {Map<string, Set<string>>} */
const inlineIgnoreCache = new Map();

/**
 * @param {string} filePath - Path to the CSS file
 * @returns {Set<string>} Set of ignored selectors
 */
function getInlineIgnores(filePath) {
  if (!inlineIgnoreCache.has(filePath)) {
    inlineIgnoreCache.set(filePath, parseInlineIgnores(filePath));
  }
  return inlineIgnoreCache.get(filePath);
}

/**
 * Checks for unused CSS classes and exits with code 1 if any are found.
 *
 * @param {{ config: import('purgecss').UserDefinedOptions }} options
 */
async function checkUnusedCss({ config }) {
  console.log('🔍 Checking for unused CSS classes');
  console.log('===================================\n');

  try {
    const purgeCSSResult = await new PurgeCSS().purge({
      ...config,
      rejected: true,
    });

    let hasUnusedClasses = false;
    const unusedByFile = [];

    for (const result of purgeCSSResult) {
      const rejected = result.rejected || [];
      if (rejected.length === 0) continue;

      const inlineIgnored = getInlineIgnores(result.file);

      const unusedClasses = rejected.filter(selector => {
        if (!/^\.[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(selector)) {
          return false;
        }
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

module.exports = { checkUnusedCss };
