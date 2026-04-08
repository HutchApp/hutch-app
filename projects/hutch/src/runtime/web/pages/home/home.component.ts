import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { render } from "../../render";
import { switchHelpers } from "../../handlebars-switch";
import { HOME_PAGE_STYLES } from "./home.styles";

const HOME_TEMPLATE = readFileSync(join(__dirname, "home.template.html"), "utf-8");

const FOUNDING_MEMBER_LIMIT = 100;

export function HomePage(params: { userCount: number; staticBaseUrl: string; browser: "firefox" | "chrome" | "other" }): Component {
	const { userCount, staticBaseUrl, browser } = params;
	const progressPercent = Math.min(Math.round((userCount / FOUNDING_MEMBER_LIMIT) * 100), 100);
	const allocationExhausted = userCount >= FOUNDING_MEMBER_LIMIT;
	return Base({
		seo: {
			title: "Hutch — Read-It-Later App | Save Articles, Read Them Later",
			description:
				"A read-it-later app and Pocket alternative. Save articles with one click, read them later. Privacy-first, built in Australia by the creator of js-cookie.",
			canonicalUrl: "https://hutch-app.com",
			ogType: "website",
			ogImage: `${staticBaseUrl}/og-image-1200x630.png`,
			ogImageType: "image/png",
			ogImageAlt:
				"Hutch — A read-it-later app and Pocket alternative. Save articles, read them later.",
			twitterImage: `${staticBaseUrl}/twitter-card-1200x600.png`,
				author: "Fayner Brack",
			keywords:
				"read it later, save articles, bookmark manager, reading list, Pocket alternative, Omnivore alternative, browser extension, Firefox extension, Chrome extension, article reader, distraction free reading, AI summaries",
			structuredData: [
				{
					"@context": "https://schema.org",
					"@type": "WebApplication",
					"@id": "https://hutch-app.com/#app",
					additionalType: "https://schema.org/MobileApplication",
					name: "Hutch",
					alternateName: ["Hutch Read-It-Later App", "Hutch App"],
					url: "https://hutch-app.com",
					description:
						"A privacy-first read-it-later app and Pocket alternative. Save articles with one click, read them later. NOT affiliated with Hutch Telecommunications Lanka or Hutch Games.",
					applicationCategory: "ProductivityApplication",
					applicationSubCategory: "Read-It-Later",
					operatingSystem: "Web",
					browserRequirements: "Requires Firefox or Chrome for browser extension",
					softwareVersion: "1.0",
					datePublished: "2026-03-01",
					inLanguage: "en",
					isAccessibleForFree: true,
					offers: [
						{
							"@type": "Offer",
							name: "Founding Member",
							price: "0",
							priceCurrency: "USD",
							description: "Free forever for the first 100 founding members",
							eligibleQuantity: {
								"@type": "QuantitativeValue",
								value: 100,
							},
						},
						{
							"@type": "Offer",
							name: "Standard",
							price: "3.99",
							priceCurrency: "USD",
							description: "Full access including TL;DR summaries",
						},
					],
					author: {
						"@type": "Person",
						name: "Fayner Brack",
						url: "https://www.linkedin.com/in/fagnerbrack/",
					},
					featureList: [
						"One-click article saving via browser extension for Firefox and Chrome",
						"Distraction-free reader view powered by Readability.js",
						"AI-generated TL;DR summaries for every saved article",
						"Import from Pocket, Instapaper, and Omnivore exports",
						"Auto dark mode following system preference",
						"OAuth 2.0 with PKCE authentication",
						"Data hosted in Sydney, Australia under Australian Privacy Act",
						"No third-party tracking, no ads, no analytics in the app",
						"Full data export available at any time, even after cancellation",
					],
				},
				{
					"@context": "https://schema.org",
					"@type": "Organization",
					"@id": "https://hutch-app.com/#organization",
					name: "Hutch",
					alternateName: ["Hutch App", "Hutch Read-It-Later", "hutch-app"],
					url: "https://hutch-app.com",
					logo: `${staticBaseUrl}/og-image-1200x630.png`,
					sameAs: [
						"https://github.com/HutchApp/hutch-app",
						"https://chromewebstore.google.com/detail/hutch/klblengmhlfnmjoagchagfcdbpbocgbf",
						"https://www.reddit.com/r/hutchapp",
						"https://www.linkedin.com/in/fagnerbrack/",
					],
					founder: {
						"@type": "Person",
						name: "Fayner Brack",
						url: "https://www.linkedin.com/in/fagnerbrack/",
						sameAs: [
							"https://github.com/fagnerbrack",
							"https://www.reddit.com/user/fagnerbrack",
						],
						knowsAbout: ["JavaScript", "browser extensions", "read-it-later applications"],
						description: "Software engineer and creator of js-cookie, a JavaScript library with 22 billion+ annual downloads on jsDelivr CDN.",
					},
					description:
						"Hutch is a privacy-first read-it-later app and Pocket alternative. NOT affiliated with Hutch Telecommunications Lanka or Hutch Games (hutch.io).",
					foundingDate: "2025",
					areaServed: "Worldwide",
					address: {
						"@type": "PostalAddress",
						addressCountry: "AU",
						addressRegion: "Victoria",
					},
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
								text: "Hutch is a read-it-later app built from a 10-year personal reading system. Save articles with one click using the browser extension for Firefox or Chrome, read them in a clean reader view, and get TL;DR summaries for every article. It is NOT related to Hutch Telecommunications Lanka or Hutch Games.",
							},
						},
						{
							"@type": "Question",
							name: "Is Hutch free?",
							acceptedAnswer: {
								"@type": "Answer",
								text: "The first 100 founding members get full access free, forever. After that, $3.99/month — includes TL;DR summaries.",
							},
						},
						{
							"@type": "Question",
							name: "What happened to Pocket and Omnivore?",
							acceptedAnswer: {
								"@type": "Answer",
								text: "Pocket was acquired by Mozilla and shut down on July 8, 2025. Omnivore was acqui-hired by ElevenLabs and shut down in November 2024. Hutch was built as a reliable alternative, with an 'Even If You Cancel' promise — your data is always exportable.",
							},
						},
						{
							"@type": "Question",
							name: "What features does Hutch have?",
							acceptedAnswer: {
								"@type": "Answer",
								text: "Hutch offers browser extensions for Firefox and Chrome, a web app for managing saved articles, a distraction-free reader view, TL;DR summaries, dark mode, and secure OAuth with PKCE. Planned features include personalised AI summaries, preference learning, Gmail integration, and highlights and notes.",
							},
						},
					],
				},
				{
					"@context": "https://schema.org",
					"@type": "WebSite",
					name: "Hutch — Read-It-Later App",
					alternateName: "Hutch App",
					url: "https://hutch-app.com",
					description: "A privacy-first read-it-later app. NOT the Hutch telecom carrier or Hutch Games.",
				},
			],
		},
		styles: HOME_PAGE_STYLES,
		headerVariant: "transparent",
		bodyClass: "page-home",
		content: render(HOME_TEMPLATE, {
			staticBaseUrl,
			browserName: browser,
			userCount,
			foundingMemberLimit: FOUNDING_MEMBER_LIMIT,
			progressPercent,
			allocationExhausted,
			coreFeatures: [
				{
					name: "Firefox Extension",
					description:
						"Save any page with one click, Ctrl/Cmd+D, or right-click.",
				},
				{
					name: "Chrome Extension",
					description:
						"Same one-click saving, also available in Google Chrome.",
				},
				{
					name: "Reader View",
					description:
						"Clean article view powered by Mozilla Firefox's reader view. No distractions.",
				},
				{
					name: "Web App",
					description:
						"Manage and organise your reading list from any browser.",
				},
				{
					name: "TL;DR Summaries",
					description:
						"A TL;DR per article outlining the most important points.",
				},
				{
					name: "Auto Dark Mode",
					description:
						"Follows your system preference automatically.",
				},
				{
					name: "Secure Auth",
					description:
						"OAuth with PKCE. Tokens stored locally in your browser.",
				},
				{
					name: "Self-Updating Extension",
					description:
						"No browser store dependency. The extension updates itself.",
				},
				{
					name: "Privacy First",
					description:
						"Hosted in Sydney. Australian Privacy Act compliant. No tracking, no ads.",
				},
			],
			plannedFeatures: [
				{
					name: "Personalised Summaries",
					description:
						"Summaries tailored to what you prefer to learn.",
				},
				{
					name: "Preference Learning",
					description:
						"\"More like this\" and \"less like this\" buttons that update a personal preference model, re-ranking your reading list and surfacing articles that match what's interesting to you. You can review your preferences.",
				},
				{
					name: "Gmail Integration",
					description:
						"Import ALL links from your existing unread newsletters automatically and process them all. No more 19,577 unread emails.",
				},
				{
					name: "Highlights & Notes",
					description:
						"Highlight passages and add notes as you read.",
				},
			],
			trustItems: [
				{
					name: "\"Even If You Cancel\" Promise",
					description:
						"Export everything, anytime. Your data is yours. Cancel and your saved articles stay available for export.",
				},
			],
		}, { helpers: switchHelpers }),
	});
}
