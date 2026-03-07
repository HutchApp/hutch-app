import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { INSTALL_PAGE_STYLES } from "./install.styles";
import { getExtensionDownloadUrl } from "firefox-extension/s3-config";

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
		content: renderInstallContent(),
	});
}

function renderInstallContent(): string {
	return `
  <main class="install-page">
    <div class="install-page__container">
      <h1 class="install-page__title">Install Hutch for Firefox</h1>
      <p class="install-page__subtitle">Save articles to your reading list with a single click or keyboard shortcut.</p>

      <a href="${EXTENSION_DOWNLOAD_URL}" class="install-page__download" data-test-cta="download-extension">Download Hutch for Firefox</a>

      <section class="install-page__steps" data-test-section="install-steps">
        <h2>Installation steps</h2>
        <ol>
          <li>Download <code>hutch.xpi</code> using the button above</li>
          <li>In Firefox, navigate to <code>about:config</code></li>
          <li>Search for <code>xpinstall.signatures.required</code> and set it to <code>false</code></li>
          <li>Navigate to <code>about:addons</code> and click Extensions</li>
          <li>Click the gear icon and select "Install Add-on From File..."</li>
          <li>Select the downloaded <code>hutch.xpi</code> file</li>
        </ol>
      </section>

      <div class="install-page__note">
        Firefox Developer Edition and Firefox Nightly allow unsigned extension installation by default — no configuration change needed.
      </div>
    </div>
  </main>`;
}
