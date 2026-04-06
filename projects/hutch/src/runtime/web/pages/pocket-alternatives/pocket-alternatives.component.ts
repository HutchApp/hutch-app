import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { render } from "../../render";
import { POCKET_ALTERNATIVES_STYLES } from "./pocket-alternatives.styles";

const TEMPLATE = readFileSync(join(__dirname, "pocket-alternatives.template.html"), "utf-8");

const POST = {
	title: "A Pocket Alternative That Won't Shut Down",
	description:
		"Pocket shut down July 2025. Hutch saves articles, shows them in a reader view, and gives you AI summaries. Free for the first 100 users.",
	slug: "pocket-alternatives",
	date: "2026-04-06",
	author: "Fayner Brack",
	keywords:
		"pocket alternative, pocket replacement, read it later app, omnivore alternative, save articles, pocket shut down, hutch app",
};

const CURRENT_FEATURES = [
	{
		name: "Browser extension",
		description: "Save any page in one click from Chrome or Firefox. Works with Ctrl/Cmd+D and right-click too.",
	},
	{
		name: "Reader view",
		description: "A clean reading mode powered by Readability.js. Strips ads, sidebars, and popups.",
	},
	{
		name: "AI TL;DR summaries",
		description: "Each saved article gets a short summary of the key points. Cached per URL. Included in the subscription at no extra cost.",
	},
	{
		name: "Dark mode",
		description: "Matches your system setting automatically.",
	},
	{
		name: "Full data export",
		description: "Download all your saved articles at any time. This works after cancellation too.",
	},
	{
		name: "Privacy-first hosting",
		description: "Hosted in Sydney, Australia. Compliant with the Australian Privacy Act. Outside US jurisdiction. No tracking, no ads.",
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
		description: "Mark passages and add notes as you read.",
	},
	{
		name: "Pocket import tool",
		description: "Upload your Pocket HTML export file into Hutch.",
	},
];

export function PocketAlternativesPage(): Component {
	return Base({
		seo: {
			title: `${POST.title} — Hutch`,
			description: POST.description,
			canonicalUrl: `https://hutch-app.com/${POST.slug}`,
			ogType: "article",
			ogImage: "https://static.hutch-app.com/og-image-1200x630.png",
			ogImageType: "image/png",
			ogImageAlt:
				"Hutch, a Pocket alternative. Save articles, read them later.",
			twitterImage: "https://static.hutch-app.com/twitter-card-1200x600.png",
			author: POST.author,
			keywords: POST.keywords,
			robots: "index, follow",
			structuredData: [
				{
					"@context": "https://schema.org",
					"@type": "BlogPosting",
					headline: POST.title,
					description: POST.description,
					datePublished: POST.date,
					dateModified: POST.date,
					url: `https://hutch-app.com/${POST.slug}`,
					author: {
						"@type": "Person",
						name: POST.author,
						url: "https://www.linkedin.com/in/fagnerbrack/",
					},
					publisher: {
						"@type": "Organization",
						name: "Hutch",
						url: "https://hutch-app.com",
					},
				},
				{
					"@context": "https://schema.org",
					"@type": "FAQPage",
					mainEntity: [
						{
							"@type": "Question",
							name: "What replaced Pocket after it shut down?",
							acceptedAnswer: {
								"@type": "Answer",
								text: "Hutch is a read-it-later app built as a direct Pocket replacement. It has browser extensions for Chrome and Firefox, a clean reader view, AI TL;DR summaries for each article, and full data export. Hutch is hosted in Australia and the source code is public under AGPL. The first 100 users get full access free.",
							},
						},
						{
							"@type": "Question",
							name: "Can I import my Pocket data into another app?",
							acceptedAnswer: {
								"@type": "Answer",
								text: "Pocket exported data as an HTML file. Hutch is building a tool to import that file. You can start saving new articles right away with the browser extension.",
							},
						},
						{
							"@type": "Question",
							name: "Is Hutch free?",
							acceptedAnswer: {
								"@type": "Answer",
								text: "The first 100 founding members get full access free, forever. After that, Hutch costs A$3.99 per month. One plan, no tiers. TL;DR summaries are included at no extra cost.",
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
