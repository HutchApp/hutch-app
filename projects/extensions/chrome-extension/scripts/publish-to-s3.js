#!/usr/bin/env node

const assert = require("node:assert");
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { chromeS3Config } = require("browser-extension-core/s3-config");
const { getBucketName, getBucketBaseUrl } = chromeS3Config;

const stage = "prod";

function buildUpdatesXml({ version, codebase }) {
	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		"<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>",
		"  <app appid='hutch-chrome-extension'>",
		`    <updatecheck codebase='${codebase}' version='${version}'/>`,
		"  </app>",
		"</gupdate>",
	].join("\n");
}

async function main() {
	assert.ok(process.env.AWS_ACCESS_KEY_ID, "AWS_ACCESS_KEY_ID is required");
	assert.ok(process.env.AWS_SECRET_ACCESS_KEY, "AWS_SECRET_ACCESS_KEY is required");

	const packageJson = JSON.parse(
		fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf-8"),
	);
	const version = packageJson.version;

	const distDir = path.join(__dirname, "..", "dist-extension-files");
	const files = fs.readdirSync(distDir);
	const prodZip = files.find(
		(f) => f.endsWith(".zip") && !f.includes("-dev"),
	);

	assert.ok(prodZip, `No production .zip found in ${distDir}. Found: ${files.join(", ")}`);

	const bucketName = getBucketName(stage);
	const baseUrl = getBucketBaseUrl(stage);

	const versionedFilename = `hutch-chrome-${version}.zip`;
	const expectedLink = `${baseUrl}/${versionedFilename}`;

	const latestUrl = `${baseUrl}/latest.txt`;
	const latestResponse = await fetch(latestUrl);
	if (latestResponse.ok) {
		const currentFilename = (await latestResponse.text()).trim();
		const currentLink = `${baseUrl}/${currentFilename}`;
		if (currentLink === expectedLink) {
			console.log(`S3 already has version ${version}. Nothing to do.`);
			return;
		}
	} else if (latestResponse.status !== 404) {
		throw new Error(`Failed to read latest.txt from S3 (${latestUrl}): ${latestResponse.status}`);
	}

	const tmpDir = "/tmp/publish-chrome-extension";
	fs.mkdirSync(tmpDir, { recursive: true });

	try {
		const localZipPath = path.join(distDir, prodZip);
		const tmpZipPath = path.join(tmpDir, versionedFilename);
		fs.copyFileSync(localZipPath, tmpZipPath);

		console.log(`Uploading ${versionedFilename} to S3...`);
		execSync(
			`aws s3 cp "${tmpZipPath}" "s3://${bucketName}/${versionedFilename}" --content-type "application/zip"`,
			{ stdio: "inherit" },
		);

		// Update updates.xml before latest.txt so auto-update pointer is
		// consistent before the install page pointer changes
		const updatesXmlPath = path.join(tmpDir, "updates.xml");
		fs.writeFileSync(
			updatesXmlPath,
			buildUpdatesXml({ version, codebase: expectedLink }),
		);
		execSync(
			`aws s3 cp "${updatesXmlPath}" "s3://${bucketName}/updates.xml" --content-type "application/xml"`,
			{ stdio: "inherit" },
		);

		const latestTxtPath = path.join(tmpDir, "latest.txt");
		fs.writeFileSync(latestTxtPath, versionedFilename);
		execSync(
			`aws s3 cp "${latestTxtPath}" "s3://${bucketName}/latest.txt" --content-type "text/plain"`,
			{ stdio: "inherit" },
		);

		console.log(`Successfully published version ${version} to S3`);
	} finally {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	}
}

main().catch((error) => {
	console.error("Publish failed:", error.message);
	process.exit(1);
});
