#!/usr/bin/env node

// Chrome 137+ removed --load-extension support in branded Google Chrome.
// E2E tests need Chrome for Testing (CfT) which still supports it.

const { execSync } = require("node:child_process");
const { writeFileSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");

const projectRoot = join(__dirname, "..");
const cacheDir = join(projectRoot, ".cache", "chrome");
mkdirSync(cacheDir, { recursive: true });

const output = execSync(
	`npx @puppeteer/browsers install chrome@stable --path "${cacheDir}"`,
	{ encoding: "utf8", timeout: 120_000, stdio: ["pipe", "pipe", "inherit"] },
);

// Output format: "chrome@{version} {path}" — path may contain spaces
const lastLine = output.trim().split("\n").pop();
const binaryPath = lastLine.replace(/^chrome@\S+\s+/, "");

writeFileSync(join(cacheDir, "binary-path"), binaryPath, "utf8");

console.log(`Chrome for Testing: ${binaryPath}`);
