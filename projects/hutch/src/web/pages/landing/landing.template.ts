import type { PageContent } from "../../base.component";
import { LANDING_PAGE_STYLES } from "./landing.styles";

export function createLandingPageContent(): PageContent {
	return {
		seo: {
			title: "Hutch — Save now. Read later. Remember forever.",
			description:
				"Pocket is gone. Omnivore is gone. Hutch is the beautiful, affordable read-it-later app that works everywhere — with unlimited highlights, full-text search, and offline reading from A$3.99/mo.",
			canonicalUrl: "https://hutchreader.com",
			ogType: "website",
			structuredData: [
				{
					"@context": "https://schema.org",
					"@type": "WebApplication",
					name: "Hutch",
					description:
						"A cross-platform read-it-later app with unlimited highlights, full-text search, and offline reading.",
					applicationCategory: "ProductivityApplication",
					operatingSystem: "Web, iOS, Android",
					offers: {
						"@type": "Offer",
						price: "0",
						priceCurrency: "AUD",
					},
				},
			],
		},
		styles: LANDING_PAGE_STYLES,
		headerVariant: "transparent",
		bodyClass: "page-landing",
		content: renderLandingContent(),
	};
}

function renderLandingContent(): string {
	return `
  <main>
    ${renderHeroSection()}
    ${renderCoreFeaturesSection()}
    ${renderPowerFeaturesSection()}
    ${renderComparisonSection()}
    ${renderPricingSection()}
    ${renderTrustSection()}
    ${renderFooterCTA()}
  </main>`;
}

function renderHeroSection(): string {
	return `
    <section class="landing-hero" data-test-section="hero">
      <div class="landing-hero__container">
        <p class="landing-hero__tagline">Read-it-later, reimagined</p>
        <h1 class="landing-hero__title">Save now.<br>Read later.<br>Remember forever.</h1>
        <p class="landing-hero__subtitle">Pocket is gone. Omnivore is gone. Hutch is the beautiful, affordable read-it-later app that works everywhere &mdash; with unlimited highlights, full-text search, and offline reading from A$3.99/mo.</p>
        <div class="landing-hero__actions">
          <a href="/signup" class="btn btn--primary" data-test-cta="start-free">Start Reading Free</a>
          <a href="#features" class="btn btn--secondary" data-test-cta="see-features">See How It Works</a>
        </div>
        <p class="landing-hero__trust">No credit card required &middot; Import from Pocket, Instapaper &amp; more</p>
      </div>
    </section>`;
}

function renderFeatureCard(f: {
	name: string;
	description: string;
	inDevelopment?: boolean;
}): string {
	const devClass = f.inDevelopment ? " feature-card--in-development" : "";
	const badge = f.inDevelopment
		? '<span class="feature-card__badge">In Development</span>'
		: "";
	return `
        <div class="feature-card${devClass}" data-test-feature="${f.name}">
          ${badge}
          <div class="feature-card__icon" aria-hidden="true"></div>
          <h3 class="feature-card__name">${f.name}</h3>
          <p class="feature-card__description">${f.description}</p>
        </div>`;
}

function renderCoreFeaturesSection(): string {
	const features = [
		{
			name: "One-Click Save",
			description:
				"Browser extension and mobile share sheet. Save any article in under a second &mdash; no modals, no friction.",
			inDevelopment: true,
		},
		{
			name: "Beautiful Reader",
			description:
				"Distraction-free reading with custom fonts, themes (Light, Sepia, Dark, OLED), and adjustable typography.",
			inDevelopment: true,
		},
		{
			name: "Unlimited Highlights",
			description:
				"Highlight in 4 colours, add inline notes, export as Markdown. No monthly limits &mdash; ever.",
			inDevelopment: true,
		},
		{
			name: "Full-Text Search",
			description:
				"Search across titles AND article body text. Filter by tags, read status, date, or reading time.",
			inDevelopment: true,
		},
		{
			name: "Offline &amp; Archived",
			description:
				"Articles auto-download for offline reading. Your archive is permanent &mdash; even if the original page disappears.",
			inDevelopment: true,
		},
		{
			name: "Cross-Platform Sync",
			description:
				"Web, iOS, Android, and browser extensions. Reading position syncs in real-time across all devices.",
			inDevelopment: true,
		},
	];

	const featureCards = features.map(renderFeatureCard).join("");

	return `
    <section id="features" class="landing-features" data-test-section="core-features">
      <div class="landing-features__header">
        <p class="landing-features__label">Core Features</p>
        <h2 class="landing-features__title">Everything you need.<br>Nothing you don't.</h2>
        <p class="landing-features__subtitle">The six essentials that Pocket users loved &mdash; rebuilt from scratch, and included at every price point.</p>
      </div>
      <div class="landing-features__grid">
        ${featureCards}
      </div>
    </section>`;
}

function renderPowerFeaturesSection(): string {
	const features = [
		{
			name: "Daily Digest",
			description:
				"Morning email with articles matched to your available reading time.",
			inDevelopment: true,
		},
		{
			name: "Newsletter Inbox",
			description:
				"Unique email alias routes newsletters straight into your reading queue.",
			inDevelopment: true,
		},
		{
			name: "Text-to-Speech",
			description:
				"Listen to articles with natural TTS. Adjustable speed, background playback.",
			inDevelopment: true,
		},
		{
			name: "Full Data Export",
			description:
				"Export everything as JSON, CSV, or Markdown. Import from Pocket, Instapaper, Omnivore.",
			inDevelopment: true,
		},
		{
			name: "AI Auto-Tagging",
			description:
				"Articles auto-tagged on save using AI. Learns your patterns over time.",
			inDevelopment: true,
		},
		{
			name: "AI Summaries",
			description:
				"One-tap TL;DR with 3&ndash;5 key points. Scan your queue faster.",
			inDevelopment: true,
		},
	];

	const featureCards = features.map(renderFeatureCard).join("");

	return `
    <section class="landing-features" data-test-section="power-features">
      <div class="landing-features__header">
        <p class="landing-features__label">Power Features</p>
        <h2 class="landing-features__title">Go further.</h2>
        <p class="landing-features__subtitle">Digests, newsletters, TTS, AI &mdash; the features that make Hutch your complete reading companion.</p>
      </div>
      <div class="landing-features__grid">
        ${featureCards}
      </div>
    </section>`;
}

function renderComparisonSection(): string {
	return `
    <section class="landing-comparison" data-test-section="comparison">
      <div class="landing-comparison__container">
        <div class="landing-comparison__header">
          <p class="landing-comparison__label">How we compare</p>
          <h2 class="landing-comparison__title">More features. Less cost.</h2>
        </div>
        <table class="comparison-table" data-test-comparison-table>
          <thead>
            <tr>
              <th></th>
              <th class="comparison-table__hutch">Hutch</th>
              <th>Readwise Reader</th>
              <th>Instapaper</th>
              <th>GoodLinks</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Price</td>
              <td class="comparison-table__hutch">A$3.99/mo</td>
              <td>A$20/mo</td>
              <td>A$9/mo</td>
              <td>A$15 once</td>
            </tr>
            <tr>
              <td>Highlights</td>
              <td class="comparison-table__hutch">Unlimited</td>
              <td>Unlimited</td>
              <td>5/month free</td>
              <td>None</td>
            </tr>
            <tr>
              <td>Search</td>
              <td class="comparison-table__hutch">Full-text</td>
              <td>Full-text</td>
              <td>Titles only (free)</td>
              <td>Titles only</td>
            </tr>
            <tr>
              <td>Platforms</td>
              <td class="comparison-table__hutch">All</td>
              <td>All</td>
              <td>All</td>
              <td>Apple only</td>
            </tr>
            <tr>
              <td>Offline Reading</td>
              <td class="comparison-table__hutch"><span class="comparison-table__check" aria-label="Yes">&#10003;</span></td>
              <td><span class="comparison-table__check" aria-label="Yes">&#10003;</span></td>
              <td><span class="comparison-table__check" aria-label="Yes">&#10003;</span></td>
              <td><span class="comparison-table__check" aria-label="Yes">&#10003;</span></td>
            </tr>
            <tr>
              <td>Text-to-Speech</td>
              <td class="comparison-table__hutch"><span class="comparison-table__check" aria-label="Yes">&#10003;</span></td>
              <td><span class="comparison-table__cross" aria-label="No">&#10007;</span></td>
              <td><span class="comparison-table__check" aria-label="Yes">&#10003;</span></td>
              <td><span class="comparison-table__cross" aria-label="No">&#10007;</span></td>
            </tr>
            <tr>
              <td>Newsletter Inbox</td>
              <td class="comparison-table__hutch"><span class="comparison-table__check" aria-label="Yes">&#10003;</span></td>
              <td><span class="comparison-table__check" aria-label="Yes">&#10003;</span></td>
              <td><span class="comparison-table__cross" aria-label="No">&#10007;</span></td>
              <td><span class="comparison-table__cross" aria-label="No">&#10007;</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>`;
}

function renderPricingSection(): string {
	return `
    <section id="pricing" class="landing-pricing" data-test-section="pricing">
      <div class="landing-pricing__container">
        <div class="landing-pricing__header">
          <p class="landing-pricing__label">Simple Pricing</p>
          <h2 class="landing-pricing__title">Half the price of Pocket Premium.</h2>
          <p class="landing-pricing__subtitle">Seriously. Every feature Pocket charged A$7.50/mo for, at A$3.99.</p>
        </div>
        <div class="pricing-grid">
          <div class="pricing-card" data-test-plan="free">
            <h3 class="pricing-card__name">Free</h3>
            <p class="pricing-card__price">A$0<span class="pricing-card__price-suffix"> forever</span></p>
            <p class="pricing-card__description">Start reading, no strings attached.</p>
            <ul class="pricing-card__features">
              <li class="pricing-card__feature">Save unlimited articles</li>
              <li class="pricing-card__feature">Reader view with all themes</li>
              <li class="pricing-card__feature">3 highlights per article</li>
              <li class="pricing-card__feature">Manual tags</li>
              <li class="pricing-card__feature">Search titles</li>
              <li class="pricing-card__feature">Sync across 2 devices</li>
              <li class="pricing-card__feature">30-day article retention</li>
            </ul>
            <a href="/signup" class="btn btn--outline pricing-card__cta" data-test-cta="free">Get Started</a>
          </div>

          <div class="pricing-card pricing-card--featured" data-test-plan="pro">
            <span class="pricing-card__badge">Most Popular</span>
            <h3 class="pricing-card__name">Pro</h3>
            <p class="pricing-card__price">A$3.99<span class="pricing-card__price-suffix">/mo</span></p>
            <p class="pricing-card__annual">A$39/yr (save ~17%)</p>
            <p class="pricing-card__description">Everything serious readers need.</p>
            <ul class="pricing-card__features">
              <li class="pricing-card__feature">Everything in Free</li>
              <li class="pricing-card__feature">Unlimited highlights &amp; notes</li>
              <li class="pricing-card__feature">Full-text search</li>
              <li class="pricing-card__feature">Permanent archive</li>
              <li class="pricing-card__feature">Offline reading</li>
              <li class="pricing-card__feature">Newsletter delivery</li>
              <li class="pricing-card__feature">Text-to-speech</li>
              <li class="pricing-card__feature">Daily reading digest</li>
              <li class="pricing-card__feature">Unlimited device sync</li>
              <li class="pricing-card__feature">Data export &amp; API</li>
            </ul>
            <a href="/signup?plan=pro" class="btn btn--brand pricing-card__cta" data-test-cta="pro">Start Free Trial</a>
          </div>

          <div class="pricing-card" data-test-plan="pro-plus">
            <h3 class="pricing-card__name">Pro+</h3>
            <p class="pricing-card__price">A$5.99<span class="pricing-card__price-suffix">/mo</span></p>
            <p class="pricing-card__annual">A$59/yr (save ~17%)</p>
            <p class="pricing-card__description">AI-powered reading intelligence.</p>
            <ul class="pricing-card__features">
              <li class="pricing-card__feature">Everything in Pro</li>
              <li class="pricing-card__feature">AI auto-tagging</li>
              <li class="pricing-card__feature">AI article summaries</li>
              <li class="pricing-card__feature">Smart recommendations</li>
              <li class="pricing-card__feature">Priority support</li>
            </ul>
            <a href="/signup?plan=pro-plus" class="btn btn--outline pricing-card__cta" data-test-cta="pro-plus">Start Free Trial</a>
          </div>
        </div>
      </div>
    </section>`;
}

function renderTrustSection(): string {
	const trustItems = [
		{
			name: "Metadata-Only Architecture",
			description:
				"We're engineered to never read your private data. This isn't a policy &mdash; it's a technical decision you can verify.",
		},
		{
			name: "\"Even If You Cancel\" Promise",
			description:
				"Export everything, anytime. Your data is yours. Cancel and your saved articles stay accessible for 90 days for export.",
		},
		{
			name: "Australian Privacy Act Compliant",
			description:
				"Built in Australia, compliant with Australian Privacy Principles. Stronger protections than most US-based competitors.",
		},
		{
			name: "Open-Source Scanner",
			description:
				"Our article extraction and classification logic is open-source. Security researchers can verify our privacy claims.",
		},
	];

	const trustCards = trustItems
		.map(
			(t) => `
        <div class="trust-card" data-test-trust="${t.name}">
          <h3 class="trust-card__name">${t.name}</h3>
          <p class="trust-card__description">${t.description}</p>
        </div>`,
		)
		.join("");

	return `
    <section id="trust" class="landing-trust" data-test-section="trust">
      <div class="landing-trust__container">
        <div class="landing-trust__header">
          <p class="landing-trust__label">Trust &amp; Privacy</p>
          <h2 class="landing-trust__title">Your reading list. Your data. Period.</h2>
          <p class="landing-trust__subtitle">Every read-it-later app that shut down left users scrambling. We're built differently &mdash; starting with your right to leave.</p>
        </div>
        <div class="trust-grid">
          ${trustCards}
        </div>
      </div>
    </section>`;
}

function renderFooterCTA(): string {
	return `
    <section class="landing-cta" data-test-section="cta">
      <div class="landing-cta__container">
        <h2 class="landing-cta__title">Your reading deserves<br>a better home.</h2>
        <p class="landing-cta__subtitle">Join thousands of readers who switched to Hutch after Pocket and Omnivore shut down. Start free &mdash; upgrade when you're ready.</p>
        <div class="landing-cta__actions">
          <a href="/signup" class="btn btn--brand" data-test-cta="bottom-start-free">Get Started Free</a>
          <a href="/import-export" class="btn btn--outline" data-test-cta="bottom-import">Import from Pocket</a>
        </div>
      </div>
    </section>`;
}
