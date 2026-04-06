import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { render } from "../../render";
import { POCKET_ALTERNATIVES_STYLES } from "./pocket-alternatives.styles";

const TEMPLATE = readFileSync(join(__dirname, "pocket-alternatives.template.html"), "utf-8");

const CURRENT_FEATURES = [
	{
		name: "Browser extension",
		description: "Save any page in one click from Chrome or Firefox. Also supports Ctrl/Cmd+D and right-click.",
	},
	{
		name: "Reader view",
		description: "Clean reading mode powered by Readability.js. No ads, no sidebars, no distractions.",
	},
	{
		name: "AI TL;DR summaries",
		description: "Every saved article gets a TL;DR summary highlighting the key points. Cached per URL, included in the subscription.",
	},
	{
		name: "Dark mode",
		description: "Follows your system preference automatically.",
	},
	{
		name: "Full data export",
		description: "Export all your saved articles anytime. Even after cancellation.",
	},
	{
		name: "Privacy-first hosting",
		description: "Hosted in Sydney, Australia. Australian Privacy Act compliant. Outside US jurisdiction. No tracking, no ads.",
	},
];

const PLANNED_FEATURES = [
	{
		name: "Tags and organisation",
		description: "Organise saved articles into categories.",
	},
	{
		name: "Full-text search",
		description: "Search across all your saved articles.",
	},
	{
		name: "Highlights and notes",
		description: "Highlight passages and add notes as you read.",
	},
	{
		name: "Pocket import tool",
		description: "Import your Pocket HTML export file directly into Hutch.",
	},
];

export function PocketAlternativesPage(): Component {
	return Base({
		seo: {
			title: "Pocket Alternative — Hutch Read-It-Later App",
			description:
				"Pocket shut down July 2025. Hutch is a read-it-later app with reader view, AI summaries, and full data export. Free for the first 100 users.",
			canonicalUrl: "https://hutch-app.com/pocket-alternatives",
			ogType: "article",
			ogImage: "https://static.hutch-app.com/og-image-1200x630.png",
			ogImageType: "image/png",
			ogImageAlt:
				"Hutch — a Pocket alternative. Save articles, read them later.",
			twitterImage: "https://static.hutch-app.com/twitter-card-1200x600.png",
			author: "Fayner Brack",
			keywords:
				"Pocket alternative, Pocket replacement, Pocket shut down, read it later app, save articles, Pocket alternative 2025, Pocket alternative 2026, Omnivore alternative, Hutch app, browser extension, AI summaries",
			structuredData: [
				{
					"@context": "https://schema.org",
					"@type": "Article",
					headline: "A Pocket alternative that won't disappear",
					description:
						"Pocket shut down on July 8, 2025. Hutch is a privacy-first read-it-later app with reader view, AI TL;DR summaries, and full data export.",
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
					"@type": "FAQPage",
					mainEntity: [
						{
							"@type": "Question",
							name: "What is the best alternative to Pocket after the shutdown?",
							acceptedAnswer: {
								"@type": "Answer",
								text: "Hutch is a read-it-later app built as a direct Pocket replacement. It offers one-click saving via browser extensions for Chrome and Firefox, a clean reader view, AI TL;DR summaries for every article, and full data export. It's privacy-first, hosted in Australia, and AGPL source-available. The first 100 users get full access free, forever.",
							},
						},
						{
							"@type": "Question",
							name: "Can I import my Pocket data into another app?",
							acceptedAnswer: {
								"@type": "Answer",
								text: "If you exported your Pocket data before the July 8, 2025 shutdown, you have an HTML file containing your saved articles. Hutch is building a Pocket import tool that will read this HTML export file directly. In the meantime, you can start saving new articles immediately with the Hutch browser extension.",
							},
						},
						{
							"@type": "Question",
							name: "Is Hutch free?",
							acceptedAnswer: {
								"@type": "Answer",
								text: "The first 100 founding members get full access free, forever. After that, Hutch costs A$3.99/month. One plan, no tiers. TL;DR summaries are included in the subscription at no extra cost.",
							},
						},
					],
				},
			],
		},
		styles: POCKET_ALTERNATIVES_STYLES,
		bodyClass: "page-pocket-alternatives",
		content: render(TEMPLATE, {
			currentFeatures: CURRENT_FEATURES,
			plannedFeatures: PLANNED_FEATURES,
		}),
	});
}
