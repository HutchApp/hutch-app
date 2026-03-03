import type { PageContent } from "../../base.component";
import { LEGAL_PAGE_STYLES } from "./privacy.styles";

export function createPrivacyPageContent(): PageContent {
	return {
		seo: {
			title: "Privacy Policy — Hutch",
			description:
				"How Hutch handles your data. We collect only what's necessary to run the service and never sell your information.",
			canonicalUrl: "https://hutch-app.com/privacy",
			robots: "noindex, follow",
		},
		styles: LEGAL_PAGE_STYLES,
		bodyClass: "page-privacy",
		content: renderPrivacyContent(),
	};
}

function renderPrivacyContent(): string {
	return `
  <main class="legal-page">
    <div class="legal-page__container">
      <h1 class="legal-page__title">Privacy Policy</h1>
      <p class="legal-page__updated">Last updated: 4 March 2026</p>

      <section class="legal-page__section">
        <h2>Who we are</h2>
        <p>Hutch ("we", "us", "our") is a read-it-later web application operated by Proficient Pty Ltd in Australia. Our website is <a href="https://hutch-app.com">hutch-app.com</a>.</p>
      </section>

      <section class="legal-page__section">
        <h2>What data we collect</h2>
        <ul>
          <li><strong>Account information:</strong> your email address, used for authentication and account recovery.</li>
          <li><strong>Saved articles:</strong> URLs, titles, and metadata of articles you save to your reading list.</li>
          <li><strong>Usage data:</strong> basic server logs (IP address, request timestamps) necessary to operate and secure the service.</li>
        </ul>
      </section>

      <section class="legal-page__section">
        <h2>What we do not collect</h2>
        <ul>
          <li>We do not use third-party analytics or tracking scripts.</li>
          <li>We do not sell, rent, or share your personal data with third parties.</li>
          <li>We do not read the content of the articles you save.</li>
        </ul>
      </section>

      <section class="legal-page__section">
        <h2>How we use your data</h2>
        <p>We use your data solely to provide the Hutch service: authenticating your account, storing your reading list, and delivering the web application to your browser.</p>
      </section>

      <section class="legal-page__section">
        <h2>Where your data is stored</h2>
        <p>Your data is stored on AWS infrastructure in the Asia-Pacific (Sydney) region. We use industry-standard security practices to protect your data.</p>
      </section>

      <section class="legal-page__section">
        <h2>Data retention and export</h2>
        <p>You can export all your data at any time from the <a href="/export">Export</a> page.</p>
      </section>

      <section class="legal-page__section">
        <h2>Cookies</h2>
        <p>We use a single session cookie to keep you logged in. We do not use advertising or tracking cookies.</p>
      </section>

      <section class="legal-page__section">
        <h2>Your rights</h2>
        <p>You have the right to access, correct, export, or delete your personal data at any time. Contact us at the address below to exercise these rights.</p>
      </section>

      <section class="legal-page__section">
        <h2>Changes to this policy</h2>
        <p>We may update this policy from time to time. We will notify registered users of material changes via email.</p>
      </section>

      <section class="legal-page__section">
        <h2>Contact</h2>
        <p>If you have questions about this privacy policy, contact us at <a href="mailto:hutch+privacy@hutch-app.com">hutch+privacy@hutch-app.com</a>.</p>
      </section>
    </div>
  </main>`;
}
