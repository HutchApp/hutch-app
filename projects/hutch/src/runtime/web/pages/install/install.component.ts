import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { render } from "../../render";
import { INSTALL_PAGE_STYLES } from "./install.styles";
import { getExtensionDownloadUrl, getLatestPointerUrl } from "firefox-extension/s3-config";

const INSTALL_TEMPLATE = readFileSync(join(__dirname, "install.template.html"), "utf-8");
const LATEST_POINTER_URL = getLatestPointerUrl("prod");

export async function fetchExtensionDownloadUrl(): Promise<string | null> {
	const response = await fetch(LATEST_POINTER_URL);
	if (!response.ok) return null;
	const xpiFilename = (await response.text()).trim();
	if (!xpiFilename) return null;
	return getExtensionDownloadUrl({ stage: "prod", xpiFilename });
}

export function InstallPage(extensionDownloadUrl: string | null): Component {
	return Base({
		seo: {
			title: "Install Hutch for Firefox",
			description:
				"Download and install the Hutch browser extension for Firefox. Save articles to your reading list with one click.",
			canonicalUrl: "https://hutch-app.com/install",
		},
		styles: INSTALL_PAGE_STYLES,
		bodyClass: "page-install",
		content: render(INSTALL_TEMPLATE, {
			extensionDownloadUrl,
		}),
	});
}
