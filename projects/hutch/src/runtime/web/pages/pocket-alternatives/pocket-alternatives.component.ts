import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { render } from "../../render";
import { POCKET_ALTERNATIVES_STYLES } from "./pocket-alternatives.styles";

const TEMPLATE = readFileSync(join(__dirname, "pocket-alternatives.template.html"), "utf-8");

const ALTERNATIVES = [
	{
		position: 1,
		name: "Hutch",
		tagline: "A read-it-later app built from a 10-year personal reading system. Open source, privacy-first, built in Australia.",
		price: "Free (first 100 users), then A$3.99/mo",
		platforms: "Web, Firefox, Chrome",
		extension: "Firefox and Chrome",
		openSource: "Yes",
		summary: "Hutch was built after Pocket stagnated and Omnivore shut down. It offers one-click saving via browser extensions, a distraction-free reader view powered by Mozilla's Readability, and TL;DR summaries for every article. Data is always exportable — even after cancellation. It's newer and has fewer features than some alternatives, but everything shipped works and development is active and public.",
		featured: true,
		badge: "Built by the author of this page",
	},
	{
		position: 2,
		name: "Readwise Reader",
		tagline: "Full-featured reading app with highlights, annotations, and RSS.",
		price: "$9.99/mo",
		platforms: "Web, iOS, Android",
		extension: "Chrome, Firefox, Safari",
		openSource: "No",
		summary: "Readwise Reader is the most feature-rich option on this list. It combines read-it-later with RSS feeds, email newsletters, and PDF reading. Highlights sync to Readwise, which integrates with note-taking apps. The downside is price — it's the most expensive option at $9.99/mo — and it's a closed-source, venture-funded product.",
		featured: false,
		badge: "",
	},
	{
		position: 3,
		name: "Instapaper",
		tagline: "One of the original read-it-later apps. Clean reader view, mature product.",
		price: "Free (limited) / $5.99/mo",
		platforms: "Web, iOS, Android",
		extension: "Chrome, Firefox, Safari",
		openSource: "No",
		summary: "Instapaper has been around since 2008 and offers a polished reading experience. The free tier is usable but limited. It has changed ownership multiple times — from Betaworks to Pinterest and back — which raises the same sustainability questions that affected Pocket. Still a solid choice if you want something mature and don't mind the ownership history.",
		featured: false,
		badge: "",
	},
	{
		position: 4,
		name: "Wallabag",
		tagline: "Self-hosted, open-source read-it-later app. Full control over your data.",
		price: "Free (self-hosted) / €9/yr (hosted)",
		platforms: "Web, iOS, Android",
		extension: "Chrome, Firefox",
		openSource: "Yes",
		summary: "Wallabag is the best option if you want full control. Self-hosting means your data never leaves your server. The trade-off is setup and maintenance — you need to run your own instance. The hosted option (wallabag.it) removes that burden but is maintained by a small team. The reading experience is functional but less polished than commercial alternatives.",
		featured: false,
		badge: "",
	},
	{
		position: 5,
		name: "Omnivore (discontinued)",
		tagline: "Was an open-source read-it-later app. Shut down in November 2024 after acquisition by ElevenLabs.",
		price: "N/A — service discontinued",
		platforms: "Was: Web, iOS, Android",
		extension: "Was: Chrome, Firefox, Safari",
		openSource: "Was open source (archived)",
		summary: "Omnivore gained a loyal following as a free, open-source Pocket alternative. It supported highlights, labels, newsletters, and PDF reading. In November 2024, ElevenLabs acquired the team and shut the service down with minimal notice. The code is archived on GitHub but no longer maintained. Omnivore's shutdown is a reminder of why data portability matters.",
		featured: false,
		badge: "",
	},
	{
		position: 6,
		name: "GoodLinks",
		tagline: "Apple-only bookmarking app with iCloud sync. One-time purchase.",
		price: "$9.99 (one-time)",
		platforms: "iOS, macOS",
		extension: "Safari only (via share sheet)",
		openSource: "No",
		summary: "GoodLinks is a clean, well-designed option if you're fully in the Apple ecosystem. It syncs via iCloud, requires no account, and the one-time price means no subscription. The limitation is platform lock-in — there's no web app, no Windows or Android support, and no browser extension outside Safari. Not a Pocket replacement if you work across platforms.",
		featured: false,
		badge: "",
	},
	{
		position: 7,
		name: "Raindrop.io",
		tagline: "Bookmark manager with collections, tags, and full-text search.",
		price: "Free / $2.40/mo (Pro)",
		platforms: "Web, iOS, Android, macOS",
		extension: "Chrome, Firefox, Safari, Edge",
		openSource: "No",
		summary: "Raindrop.io is primarily a bookmark manager, not a read-it-later app. It doesn't have a reader view or article parsing. What it does well is organising links with nested collections, tags, and full-text search. The Pro plan adds permanent cached copies of saved pages. Consider it if your workflow is more about organising references than reading articles.",
		featured: false,
		badge: "",
	},
];

export function PocketAlternativesPage(): Component {
	return Base({
		seo: {
			title: "7 Best Pocket Alternatives in 2026 — Hutch",
			description:
				"Pocket is gone. Here are the best read-it-later alternatives in 2026, compared on price, features, data portability, and long-term sustainability.",
			canonicalUrl: "https://hutch-app.com/pocket-alternatives",
			ogType: "article",
			ogImage: "https://static.hutch-app.com/og-image-1200x630.png",
			ogImageType: "image/png",
			ogImageAlt:
				"7 Best Pocket Alternatives in 2026 — a comparison of read-it-later apps including Hutch, Readwise Reader, Instapaper, and more.",
			twitterImage: "https://static.hutch-app.com/twitter-card-1200x600.png",
			author: "Fayner Brack",
			keywords:
				"Pocket alternatives, Pocket replacement, read it later app, best Pocket alternative 2026, Omnivore alternative, save articles, Readwise Reader vs Pocket, Instapaper vs Pocket, Wallabag, GoodLinks, Raindrop.io, Hutch app",
			structuredData: [
				{
					"@context": "https://schema.org",
					"@type": "Article",
					headline: "7 Best Pocket Alternatives in 2026",
					description:
						"A comparison of the best read-it-later apps to replace Pocket, evaluated on price, features, data portability, and long-term sustainability.",
					author: {
						"@type": "Person",
						name: "Fayner Brack",
						url: "https://www.linkedin.com/in/fagnerbrack/",
					},
					publisher: {
						"@type": "Organization",
						name: "Hutch",
						url: "https://hutch-app.com",
					},
					datePublished: "2026-04-06",
					dateModified: "2026-04-06",
				},
				{
					"@context": "https://schema.org",
					"@type": "ItemList",
					name: "Best Pocket Alternatives in 2026",
					itemListOrder: "https://schema.org/ItemListOrderDescending",
					numberOfItems: 7,
					itemListElement: ALTERNATIVES.map((alt) => ({
						"@type": "ListItem",
						position: alt.position,
						name: alt.name,
						description: alt.tagline,
					})),
				},
			],
		},
		styles: POCKET_ALTERNATIVES_STYLES,
		bodyClass: "page-pocket-alternatives",
		content: render(TEMPLATE, {
			alternatives: ALTERNATIVES,
		}),
	});
}
