import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { render } from "../../render";
import { LANDING_PAGE_STYLES } from "./landing.styles";

const LANDING_TEMPLATE = readFileSync(join(__dirname, "landing.template.html"), "utf-8");

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
		content: render(LANDING_TEMPLATE, {
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
			],
			plannedFeatures: [
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
