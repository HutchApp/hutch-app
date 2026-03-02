import type { PageContent } from "../../base.component";
import { LANDING_PAGE_STYLES } from "./landing.styles";

export function createLandingPageContent(): PageContent {
	return {
		seo: {
			title: "Hutch — A read-it-later app by Fagner Brack",
			description:
				"Pocket is gone. Omnivore is gone. Hutch is a read-it-later app built from a 10-year personal reading system. Save articles with one click, read them later. Built in Australia by a solo developer.",
			canonicalUrl: "https://hutchreader.com",
			ogType: "website",
			ogImage: "https://hutchreader.com/og-image-1200x630.png",
			twitterImage: "https://hutchreader.com/twitter-card-1200x600.png",
			structuredData: [
				{
					"@context": "https://schema.org",
					"@type": "WebApplication",
					name: "Hutch",
					description:
						"A read-it-later app built from a 10-year personal reading system. Save articles, read them later.",
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
    ${renderRoadmapSection()}
    ${renderBackstorySection()}
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
        <p class="landing-hero__tagline">A read-it-later app by Fagner Brack</p>
        <h1 class="landing-hero__title">Save now.<br>Read later.<br>That's it.</h1>
        <p class="landing-hero__subtitle">Pocket is gone. Omnivore is gone. I built Hutch from a personal reading system I've maintained for 10 years &mdash; because I needed a replacement too.</p>
        <div class="landing-hero__actions">
          <a href="/install" class="btn btn--primary" data-test-cta="install-extension">Install the Extension</a>
          <a href="#what-works" class="btn btn--secondary" data-test-cta="see-features">See What Works Today</a>
        </div>
        <p class="landing-hero__trust">Chrome &amp; Firefox &middot; Import from Pocket, Instapaper &amp; Omnivore</p>
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
			name: "Browser Extension",
			description:
				"Save any page in one click from Chrome or Firefox. No modals, no friction.",
		},
		{
			name: "Web App",
			description:
				"View and manage your saved articles from any browser. Clean, fast, no clutter.",
		},
		{
			name: "Import Your Library",
			description:
				"Bring your articles from Pocket, Instapaper, or Omnivore. One upload, everything transferred.",
		},
	];

	const featureCards = features.map(renderFeatureCard).join("");

	return `
    <section id="what-works" class="landing-features" data-test-section="core-features">
      <div class="landing-features__header">
        <p class="landing-features__label">What Works Today</p>
        <h2 class="landing-features__title">Save articles. Read them later.</h2>
        <p class="landing-features__subtitle">These features are shipped and working right now. Install the extension and try them.</p>
      </div>
      <div class="landing-features__grid">
        ${featureCards}
      </div>
    </section>`;
}

function renderRoadmapSection(): string {
	const planned = [
		{
			name: "Reader View",
			description:
				"Distraction-free reading with custom fonts, themes, and adjustable typography.",
		},
		{
			name: "Highlights &amp; Notes",
			description:
				"Highlight in multiple colours, add inline notes, export as Markdown.",
		},
		{
			name: "Full-Text Search",
			description:
				"Search across titles and article body text. Filter by tags, read status, and date.",
		},
		{
			name: "Offline Reading",
			description:
				"Articles auto-download for offline access. Your archive persists even if the original page disappears.",
		},
		{
			name: "Text-to-Speech",
			description:
				"Listen to articles with natural TTS. Adjustable speed, background playback.",
		},
		{
			name: "Newsletter Inbox",
			description:
				"Unique email alias routes newsletters straight into your reading queue.",
		},
	];

	const roadmapCards = planned.map(renderFeatureCard).join("");

	return `
    <section class="landing-features" data-test-section="roadmap">
      <div class="landing-features__header">
        <p class="landing-features__label">What's Coming</p>
        <h2 class="landing-features__title">Built in public. Shaped by users.</h2>
        <p class="landing-features__subtitle">I'm building these next. Vote on what matters most to you on the <a href="/roadmap">feature board</a>.</p>
      </div>
      <div class="landing-features__grid">
        ${roadmapCards}
      </div>
    </section>`;
}

function renderBackstorySection(): string {
	return `
    <section class="landing-backstory" data-test-section="backstory">
      <div class="landing-backstory__container">
        <h2 class="landing-backstory__title">Why I built this</h2>
        <div class="landing-backstory__content">
          <p>I'm Fagner Brack. You might know me as the creator of <a href="https://www.jsdelivr.com/package/npm/js-cookie">js-cookie</a>, a JavaScript library with over 22 billion downloads per year on jsDelivr. I've been building for the web for a long time.</p>
          <p>For the past 10 years, I've maintained a personal reading system &mdash; a pipeline of Gmail filters, DynamoDB tables, and Reddit automations that helped me save, organise, and actually read the articles I cared about. That system generated 300,000+ Reddit karma across technical communities.</p>
          <p>When Pocket was acquired and then abandoned, and Omnivore shut down overnight, I realised the tool I needed didn't exist as a product anyone could use. So I'm turning my personal system into Hutch &mdash; built in Australia, one feature at a time.</p>
          <p>This is a solo project. I'm building it in public, and I'd rather be honest about what works today than promise features that don't exist yet.</p>
        </div>
      </div>
    </section>`;
}

function renderComparisonSection(): string {
	return `
    <section class="landing-comparison" data-test-section="comparison">
      <div class="landing-comparison__container">
        <div class="landing-comparison__header">
          <p class="landing-comparison__label">Honest Comparison</p>
          <h2 class="landing-comparison__title">Where Hutch stands today.</h2>
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
              <td class="comparison-table__hutch">A$29/yr founding</td>
              <td>A$20/mo</td>
              <td>A$9/mo</td>
              <td>A$15 once</td>
            </tr>
            <tr>
              <td>Browser Extension</td>
              <td class="comparison-table__hutch"><span class="comparison-table__check" aria-label="Yes">&#10003;</span></td>
              <td><span class="comparison-table__check" aria-label="Yes">&#10003;</span></td>
              <td><span class="comparison-table__check" aria-label="Yes">&#10003;</span></td>
              <td><span class="comparison-table__cross" aria-label="No">&#10007;</span></td>
            </tr>
            <tr>
              <td>Import Library</td>
              <td class="comparison-table__hutch"><span class="comparison-table__check" aria-label="Yes">&#10003;</span></td>
              <td><span class="comparison-table__check" aria-label="Yes">&#10003;</span></td>
              <td><span class="comparison-table__check" aria-label="Yes">&#10003;</span></td>
              <td><span class="comparison-table__cross" aria-label="No">&#10007;</span></td>
            </tr>
            <tr>
              <td>Platforms</td>
              <td class="comparison-table__hutch">Web + Extensions</td>
              <td>All</td>
              <td>All</td>
              <td>Apple only</td>
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
          <h2 class="landing-pricing__title">Try it free. Support the project if you like it.</h2>
        </div>
        <div class="pricing-grid">
          <div class="pricing-card" data-test-plan="free">
            <h3 class="pricing-card__name">Free</h3>
            <p class="pricing-card__price">A$0<span class="pricing-card__price-suffix"> forever</span></p>
            <p class="pricing-card__description">Try Hutch with no commitment.</p>
            <ul class="pricing-card__features">
              <li class="pricing-card__feature">Save unlimited articles</li>
              <li class="pricing-card__feature">Browser extension</li>
              <li class="pricing-card__feature">Import from other apps</li>
              <li class="pricing-card__feature">Manual tags</li>
              <li class="pricing-card__feature">Search titles</li>
            </ul>
            <a href="/signup" class="btn btn--outline pricing-card__cta" data-test-cta="free">Get Started</a>
          </div>

          <div class="pricing-card pricing-card--featured" data-test-plan="founding">
            <span class="pricing-card__badge">First 100 Users</span>
            <h3 class="pricing-card__name">Founding Member</h3>
            <p class="pricing-card__price">A$29<span class="pricing-card__price-suffix">/yr</span></p>
            <p class="pricing-card__description">Lock in this price permanently. Help shape the product.</p>
            <ul class="pricing-card__features">
              <li class="pricing-card__feature">Everything in Free</li>
              <li class="pricing-card__feature">All Pro features as they ship</li>
              <li class="pricing-card__feature">Direct access to the developer</li>
              <li class="pricing-card__feature">Vote on feature priorities</li>
              <li class="pricing-card__feature">Price locked for life</li>
            </ul>
            <a href="/signup?plan=founding" class="btn btn--brand pricing-card__cta" data-test-cta="founding">Become a Founding Member</a>
          </div>

          <div class="pricing-card" data-test-plan="pro">
            <h3 class="pricing-card__name">Pro</h3>
            <p class="pricing-card__price">A$3.99<span class="pricing-card__price-suffix">/mo</span></p>
            <p class="pricing-card__annual">A$39/yr (save ~17%)</p>
            <p class="pricing-card__description">Full access once all features ship.</p>
            <ul class="pricing-card__features">
              <li class="pricing-card__feature">Everything in Free</li>
              <li class="pricing-card__feature">Unlimited highlights &amp; notes</li>
              <li class="pricing-card__feature">Full-text search</li>
              <li class="pricing-card__feature">Permanent archive</li>
              <li class="pricing-card__feature">Offline reading</li>
              <li class="pricing-card__feature">Data export</li>
            </ul>
            <a href="/signup?plan=pro" class="btn btn--outline pricing-card__cta" data-test-cta="pro">Start Free Trial</a>
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
				"I built Hutch to never read your private data. This isn't a policy &mdash; it's a technical decision you can verify.",
		},
		{
			name: "\"Even If You Cancel\" Promise",
			description:
				"Export everything, anytime. Your data is yours. Cancel and your saved articles stay accessible for 90 days for export.",
		},
		{
			name: "Self-Hosted Analytics",
			description:
				"Hutch uses self-hosted Plausible Analytics. No Google Analytics, no third-party trackers, no data sold to advertisers.",
		},
		{
			name: "Australian Privacy Act Compliant",
			description:
				"Built in Australia, compliant with Australian Privacy Principles. Magic link auth &mdash; no passwords stored.",
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
          <p class="landing-trust__subtitle">Every read-it-later app that shut down left users scrambling. Hutch is built differently &mdash; starting with your right to leave.</p>
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
        <h2 class="landing-cta__title">I'm building this in public.</h2>
        <p class="landing-cta__subtitle">Try the extension, tell me what to build next. Hutch gets better with every user who shows up and says what they need.</p>
        <div class="landing-cta__actions">
          <a href="/install" class="btn btn--brand" data-test-cta="bottom-install">Install the Extension</a>
          <a href="/import-export" class="btn btn--outline" data-test-cta="bottom-import">Import from Pocket</a>
        </div>
      </div>
    </section>`;
}
