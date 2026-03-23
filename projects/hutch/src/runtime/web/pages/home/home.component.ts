import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { render } from "../../render";
import { HOME_PAGE_STYLES } from "./home.styles";

const HOME_TEMPLATE = readFileSync(join(__dirname, "home.template.html"), "utf-8");

const FOUNDING_MEMBER_LIMIT = 100;

export function HomePage(params: { userCount: number }): Component {
	const { userCount } = params;
	const progressPercent = Math.min(Math.round((userCount / FOUNDING_MEMBER_LIMIT) * 100), 100);
	const allocationExhausted = userCount >= FOUNDING_MEMBER_LIMIT;
	return Base({
		seo: {
			title: "Hutch — A read-it-later app by <a href=\"https://reddit.com/u/fagnerbrack\">Fayner Brack</a>",
			description:
				"Pocket is gone. Omnivore is gone. Hutch is a read-it-later app built from a 10-year personal reading system. Save articles with one click, read them later. Built in Australia by a solo developer.",
			canonicalUrl: "https://hutch-app.com",
			ogType: "website",
			ogImage: "https://hutch-app.com/og-image-1200x630.png",
			ogImageType: "image/png",
			ogImageAlt:
				"Hutch — Save now, read later. A read-it-later app built in Australia.",
			twitterImage: "https://hutch-app.com/twitter-card-1200x600.png",
				author: "Fayner Brack",
			keywords:
				"read it later, save articles, bookmark manager, reading list, Pocket alternative, Omnivore alternative, browser extension, Firefox extension, article reader, distraction free reading",
			structuredData: [
				{
					"@context": "https://schema.org",
					"@type": "WebApplication",
					name: "Hutch",
					url: "https://hutch-app.com",
					description:
						"A read-it-later app built from a 10-year personal reading system. Save articles, read them later.",
					applicationCategory: "ProductivityApplication",
					operatingSystem: "Web, iOS, Android",
					browserRequirements: "Requires Firefox for browser extension",
					offers: {
						"@type": "Offer",
						price: "0",
						priceCurrency: "AUD",
						description: "Free forever for the first 100 founding members",
					},
					author: {
						"@type": "Person",
						name: "Fayner Brack",
						url: "https://www.linkedin.com/in/fagnerbrack/",
					},
					featureList: [
						"One-click article saving via Firefox extension",
						"Web app for managing saved articles",
						"Distraction-free reader view with clean typography",
					],
				},
				{
					"@context": "https://schema.org",
					"@type": "Organization",
					name: "Hutch",
					url: "https://hutch-app.com",
					logo: "https://hutch-app.com/og-image-1200x630.png",
					sameAs: [
						"https://www.reddit.com/r/hutchapp",
						"https://www.linkedin.com/in/fagnerbrack/",
					],
					founder: {
						"@type": "Person",
						name: "Fayner Brack",
					},
					description:
						"Hutch is a read-it-later app built in Australia by a solo developer.",
				},
				{
					"@context": "https://schema.org",
					"@type": "FAQPage",
					mainEntity: [
						{
							"@type": "Question",
							name: "What is Hutch?",
							acceptedAnswer: {
								"@type": "Answer",
								text: "Hutch is a read-it-later app built from a 10-year personal reading system. Save articles with one click using the Firefox browser extension, and read them later in a distraction-free reader view.",
							},
						},
						{
							"@type": "Question",
							name: "Is Hutch free?",
							acceptedAnswer: {
								"@type": "Answer",
								text: "Yes. The first 100 founding members get full access free, forever. This includes unlimited article saving, the browser extension, all features as they ship, and direct access to the developer.",
							},
						},
						{
							"@type": "Question",
							name: "What happened to Pocket and Omnivore?",
							acceptedAnswer: {
								"@type": "Answer",
								text: "Pocket was acquired and then abandoned, and Omnivore shut down overnight. Hutch was built as a reliable alternative, with an 'Even If You Cancel' promise — your data is always exportable.",
							},
						},
						{
							"@type": "Question",
							name: "What features does Hutch have?",
							acceptedAnswer: {
								"@type": "Answer",
								text: "Hutch currently offers a Firefox browser extension for one-click saving, a web app for managing saved articles, and a distraction-free reader view. Planned features include highlights and notes, full-text search, offline reading, text-to-speech, and a newsletter inbox.",
							},
						},
					],
				},
			],
		},
		styles: HOME_PAGE_STYLES,
		headerVariant: "transparent",
		bodyClass: "page-home",
		content: render(HOME_TEMPLATE, {
			userCount,
			foundingMemberLimit: FOUNDING_MEMBER_LIMIT,
			progressPercent,
			allocationExhausted,
			coreFeatures: [
				{
					name: "Firefox Browser Extension",
					description:
						"Save any page in one click from Firefox. No friction.",
				},
				{
					name: "Web App",
					description:
						"View and manage your saved articles from any browser. Clean, fast, no clutter.",
				},
				{
					name: "Reader View",
					description:
						"Distraction-free reading with clean fonts, themes, and typography.",
				},
				{
					name: "TL;DR Summary",
					description:
						"Summaries for every link you save. Get the key points instantly before diving into the full read.",
				}
			],
			plannedFeatures: [
				{
					name: "Email Link Import",
					description:
						"Import links from your email to Hutch queue",
				},
				{
					name: "AI Daily/Weekly Email Digest",
					description:
						"Using AI, send an email to yourself daily/weekly with the links that fit your interests",
				},
				{
					name: "Highlights & Notes",
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
			],
			trustItems: [
				{
					name: "\"Even If You Cancel\" Promise",
					description:
						"Export everything, anytime. Your data is yours. Cancel and your saved articles stay available for export.",
				},
			],
		}),
	});
}
