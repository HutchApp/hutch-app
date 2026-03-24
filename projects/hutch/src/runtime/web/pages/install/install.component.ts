import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { render } from "../../render";
import { INSTALL_PAGE_STYLES } from "./install.styles";
import { getExtensionDownloadUrl as getFirefoxDownloadUrl, getLatestPointerUrl as getFirefoxLatestUrl } from "firefox-extension/s3-config";
import { getExtensionDownloadUrl as getChromeDownloadUrl, getLatestPointerUrl as getChromeLatestUrl } from "chrome-extension/s3-config";

const INSTALL_TEMPLATE = readFileSync(join(__dirname, "install.template.html"), "utf-8");
const FIREFOX_LATEST_POINTER_URL = getFirefoxLatestUrl("prod");
const CHROME_LATEST_POINTER_URL = getChromeLatestUrl("prod");

async function fetchDownloadUrl(latestPointerUrl: string, buildDownloadUrl: (filename: string) => string): Promise<string | null> {
	const response = await fetch(latestPointerUrl);
	if (!response.ok) return null;
	const filename = (await response.text()).trim();
	if (!filename) return null;
	return buildDownloadUrl(filename);
}

export async function fetchFirefoxDownloadUrl(): Promise<string | null> {
	return fetchDownloadUrl(FIREFOX_LATEST_POINTER_URL, (xpiFilename) =>
		getFirefoxDownloadUrl({ stage: "prod", xpiFilename }),
	);
}

export async function fetchChromeDownloadUrl(): Promise<string | null> {
	return fetchDownloadUrl(CHROME_LATEST_POINTER_URL, (zipFilename) =>
		getChromeDownloadUrl({ stage: "prod", zipFilename }),
	);
}

export function InstallPage(downloads: { firefox: string | null; chrome: string | null }): Component {
	return Base({
		seo: {
			title: "Install Hutch Browser Extension",
			description:
				"Download and install the Hutch browser extension for Firefox or Chrome. Save articles to your reading list with one click.",
			canonicalUrl: "https://hutch-app.com/install",
		},
		styles: INSTALL_PAGE_STYLES,
		bodyClass: "page-install",
		content: render(INSTALL_TEMPLATE, {
			firefoxDownloadUrl: downloads.firefox,
			chromeDownloadUrl: downloads.chrome,
		}),
	});
}
