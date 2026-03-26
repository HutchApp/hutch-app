#!/usr/bin/env node

// Chrome 137+ removed --load-extension support in branded Google Chrome.
// E2E tests need Chrome for Testing (CfT) which still supports it.
// We also install the matching ChromeDriver so Selenium uses a compatible version.

const assert = require("node:assert");
const { execSync } = require("node:child_process");
const { writeFileSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");

const projectRoot = join(__dirname, "..");
const cacheDir = join(projectRoot, ".cache", "chrome");
mkdirSync(cacheDir, { recursive: true });

const chromeOutput = execSync(
	`npx @puppeteer/browsers install chrome@stable --path "${cacheDir}"`,
	{ encoding: "utf8", timeout: 120_000, stdio: ["pipe", "pipe", "inherit"] },
);

// Output format: "chrome@{version} {path}" — path may contain spaces
const chromeLastLine = chromeOutput.trim().split("\n").pop();
const chromeBinaryPath = chromeLastLine.replace(/^chrome@\S+\s+/, "");
const chromeMatch = chromeLastLine.match(/^chrome@(\S+)/);
assert(chromeMatch, `Unexpected chrome install output: ${chromeLastLine}`);
const chromeVersion = chromeMatch[1];

writeFileSync(join(cacheDir, "binary-path"), chromeBinaryPath, "utf8");
console.log(`Chrome for Testing: ${chromeBinaryPath}`);

const driverOutput = execSync(
	`npx @puppeteer/browsers install chromedriver@${chromeVersion} --path "${cacheDir}"`,
	{ encoding: "utf8", timeout: 120_000, stdio: ["pipe", "pipe", "inherit"] },
);

const driverLastLine = driverOutput.trim().split("\n").pop();
const driverMatch = driverLastLine.match(/^chromedriver@(\S+)/);
assert(driverMatch, `Unexpected chromedriver install output: ${driverLastLine}`);
const driverBinaryPath = driverLastLine.replace(/^chromedriver@\S+\s+/, "");

writeFileSync(join(cacheDir, "driver-path"), driverBinaryPath, "utf8");
console.log(`ChromeDriver: ${driverBinaryPath}`);
