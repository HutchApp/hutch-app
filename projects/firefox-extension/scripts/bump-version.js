#!/usr/bin/env node
const { readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const projectRoot = join(__dirname, "..");
const arg = process.argv[2] || "patch";

const packageJsonPath = join(projectRoot, "package.json");
const manifestPath = join(projectRoot, "src/runtime/manifest.json");

const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

const oldVersion = packageJson.version;
const parts = oldVersion.split(".").map(Number);

if (parts.length !== 3 || parts.some(isNaN)) {
	console.error(`Current version is not valid semver: ${oldVersion}`);
	process.exit(1);
}

const explicitPatch = Number(arg);

if (!isNaN(explicitPatch) && Number.isInteger(explicitPatch) && explicitPatch >= 0) {
	parts[2] = explicitPatch;
} else if (arg === "minor") {
	parts[1] += 1;
	parts[2] = 0;
} else if (arg === "patch") {
	parts[2] += 1;
} else {
	console.error(`Invalid argument: ${arg}`);
	console.error("Usage: node scripts/bump-version.js [patch|minor|<number>]");
	console.error("  patch   - increment patch (default)");
	console.error("  minor   - increment minor, reset patch to 0");
	console.error("  <number> - set patch to explicit value (e.g., CI run number)");
	console.error("Major bumps must be done manually.");
	process.exit(1);
}

const newVersion = parts.join(".");

packageJson.version = newVersion;
manifest.version = newVersion;

writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

console.log(`Bumped version: ${oldVersion} → ${newVersion}`);
