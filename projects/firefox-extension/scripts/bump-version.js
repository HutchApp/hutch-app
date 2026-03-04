#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

const newVersion = process.argv[2];

if (!newVersion) {
  console.error("Usage: node scripts/bump-version.js <version>");
  console.error("Example: node scripts/bump-version.js 1.2.0");
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
  console.error(`Invalid version format: ${newVersion}`);
  console.error("Expected format: MAJOR.MINOR.PATCH (e.g., 1.2.0)");
  process.exit(1);
}

const packageJsonPath = join(projectRoot, "package.json");
const manifestPath = join(projectRoot, "src/runtime/manifest.json");

const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

const oldVersion = packageJson.version;

packageJson.version = newVersion;
manifest.version = newVersion;

writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

console.log(`Bumped version: ${oldVersion} → ${newVersion}`);
console.log(`  Updated: package.json`);
console.log(`  Updated: src/runtime/manifest.json`);
