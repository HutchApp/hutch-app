import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { render } from "../../render";
import { INSTALL_PAGE_STYLES } from "./install.styles";
import { getExtensionDownloadUrl } from "firefox-extension/s3-config";

const INSTALL_TEMPLATE = readFileSync(join(__dirname, "install.template.html"), "utf-8");
const EXTENSION_DOWNLOAD_URL = getExtensionDownloadUrl("prod");

export function InstallPage(): Component {
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
			extensionDownloadUrl: EXTENSION_DOWNLOAD_URL,
		}),
	});
}
