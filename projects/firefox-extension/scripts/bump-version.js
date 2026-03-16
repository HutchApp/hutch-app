#!/usr/bin/env node
const { readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const { initBumpVersion, parseBumpType } = require("../dist/bump-version");

const projectRoot = join(__dirname, "..");
const arg = process.argv[2] || "patch";

const bumpType = parseBumpType(arg);

const bumpVersion = initBumpVersion({
	readFile: (path) => readFileSync(path, "utf-8"),
	writeFile: (path, content) => writeFileSync(path, content),
});

const result = bumpVersion({
	bumpType,
	packageJsonPath: join(projectRoot, "package.json"),
	manifestPath: join(projectRoot, "src/runtime/manifest.json"),
});

console.log(`Bumped version: ${result.oldVersion} → ${result.newVersion}`);
