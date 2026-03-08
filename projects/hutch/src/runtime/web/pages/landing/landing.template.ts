import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { LANDING_PAGE_STYLES } from "./landing.styles";

export function LandingPage(): Component {
	return Base({
		seo: {
			title: "Hutch — A read-it-later app by Fayner Brack",
			description:
				"Pocket is gone. Omnivore is gone. Hutch is a read-it-later app built from a 10-year personal reading system. Save articles with one click, read them later. Built in Australia by a solo developer.",
			canonicalUrl: "https://hutch-app.com",
			ogType: "website",
			ogImage: "https://hutch-app.com/og-image-1200x630.png",
			twitterImage: "https://hutch-app.com/twitter-card-1200x600.png",
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
	});
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
        <p class="landing-hero__tagline">A read-it-later app by Fayner Brack</p>
        <h1 class="landing-hero__title">Save now.<br>Read later.<br>That's it.</h1>
        <p class="landing-hero__subtitle">Pocket is gone. Omnivore is gone. I built Hutch from a personal reading system I've maintained for 10 years &mdash; because I needed a replacement too.</p>
        <div class="landing-hero__actions">
          <a href="/install" class="btn btn--primary" data-test-cta="install-extension">Install the Extension</a>
          <a href="#what-works" class="btn btn--secondary" data-test-cta="see-features">See What Works Today</a>
        </div>
        <p class="landing-hero__trust">Firefox</p>
      </div>
    </section>`;
}

function renderFeatureCard(f: { name: string; description: string }): string {
	return `
        <div class="feature-card" data-test-feature="${f.name}">
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
			name: "Reader View",
			description:
				"Distraction-free reading with custom fonts, themes, and adjustable typography.",
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
    <section id="roadmap" class="landing-features" data-test-section="roadmap">
      <div class="landing-features__header">
        <p class="landing-features__label">What's Coming</p>
        <h2 class="landing-features__title">Built in public. Shaped by users.</h2>
        <p class="landing-features__subtitle">I'm planning to build these. Vote on what matters most to you on the <a href="https://www.reddit.com/r/hutchapp">Reddit community</a>.</p>
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
          <p>I'm <a href="https://www.reddit.com/user/fagnerbrack/">Fayner Brack</a>. You might know me as the creator of <a href="https://www.jsdelivr.com/package/npm/js-cookie">js-cookie</a>, a JavaScript library with over 22 billion downloads per year on jsDelivr. I've been building for the web for a long time.</p>
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
              <td class="comparison-table__hutch">Free (first 100)</td>
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
          <h2 class="landing-pricing__title">Free for the first 100 users.</h2>
        </div>
        <div class="pricing-grid">
          <div class="pricing-card pricing-card--featured" data-test-plan="founding">
            <span class="pricing-card__badge">First 100 Users</span>
            <h3 class="pricing-card__name">Founding Member</h3>
            <p class="pricing-card__price">A$0<span class="pricing-card__price-suffix"> forever</span></p>
            <p class="pricing-card__description">Be one of the first 100 users. Get full access free, forever. Help shape the product.</p>
            <ul class="pricing-card__features">
              <li class="pricing-card__feature">Save unlimited articles</li>
              <li class="pricing-card__feature">Browser extension</li>

              <li class="pricing-card__feature">All features as they ship</li>
              <li class="pricing-card__feature">Direct access to the developer</li>
              <li class="pricing-card__feature">Vote on feature priorities</li>
            </ul>
            <a href="/signup" class="btn btn--brand pricing-card__cta" data-test-cta="founding">Become a Founding Member</a>
          </div>
        </div>
      </div>
    </section>`;
}

function renderTrustSection(): string {
	const trustItems = [
		{
			name: "\"Even If You Cancel\" Promise",
			description:
				"Export everything, anytime. Your data is yours. Cancel and your saved articles stay available for export.",
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
        </div>
      </div>
    </section>`;
}
