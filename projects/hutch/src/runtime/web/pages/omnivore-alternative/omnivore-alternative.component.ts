import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { render } from "../../render";
import { switchHelpers } from "../../handlebars-switch";
import { OMNIVORE_ALTERNATIVE_PAGE_STYLES } from "./omnivore-alternative.styles";

const OMNIVORE_TEMPLATE = readFileSync(join(__dirname, "omnivore-alternative.template.html"), "utf-8");

const FOUNDING_MEMBER_LIMIT = 100;

export function OmnivoreAlternativePage(params: { userCount: number; staticBaseUrl: string; browser: "firefox" | "chrome" | "other" }): Component {
	const { userCount, staticBaseUrl, browser } = params;
	const progressPercent = Math.min(Math.round((userCount / FOUNDING_MEMBER_LIMIT) * 100), 100);
	const allocationExhausted = userCount >= FOUNDING_MEMBER_LIMIT;
	return Base({
		seo: {
			title: "Omnivore Alternative | Hutch Read-It-Later App",
			description:
				"Omnivore shut down with two weeks notice. Hutch is a privacy-first read-it-later app built by a developer, with AGPL source code and no VC funding.",
			canonicalUrl: "https://hutch-app.com/omnivore-alternative",
			ogType: "website",
			ogImage: `${staticBaseUrl}/og-image-1200x630.png`,
			ogImageType: "image/png",
			ogImageAlt:
				"Hutch — A read-it-later app and Omnivore alternative. Save articles, read them later.",
			twitterImage: `${staticBaseUrl}/twitter-card-1200x600.png`,
			author: "Fayner Brack",
			keywords:
				"Omnivore alternative, Omnivore replacement, Omnivore shut down, read it later app, Omnivore shutdown, ElevenLabs Omnivore, save articles, AGPL read it later, privacy first bookmark manager, Readwise Reader alternative",
			structuredData: [
				{
					"@context": "https://schema.org",
					"@type": "WebPage",
					name: "Omnivore Alternative — Hutch",
					url: "https://hutch-app.com/omnivore-alternative",
					description:
						"Hutch is a privacy-first read-it-later app and Omnivore alternative. Built by a developer, funded by subscriptions, with AGPL source code.",
					isPartOf: {
						"@type": "WebSite",
						name: "Hutch",
						url: "https://hutch-app.com",
					},
					author: {
						"@type": "Person",
						name: "Fayner Brack",
						url: "https://www.linkedin.com/in/fagnerbrack/",
					},
				},
				{
					"@context": "https://schema.org",
					"@type": "FAQPage",
					mainEntity: [
						{
							"@type": "Question",
							name: "What happened to Omnivore?",
							acceptedAnswer: {
								"@type": "Answer",
								text: "ElevenLabs acquired Omnivore on November 1, 2024, and shut it down on November 15. Users had roughly two weeks to export their data before deletion began. The open-source repository was archived and Omnivore is not coming back.",
							},
						},
						{
							"@type": "Question",
							name: "Is there a free Omnivore alternative?",
							acceptedAnswer: {
								"@type": "Answer",
								text: "Hutch is free for the first 100 founding members with full access forever. After that, A$3.99/month (roughly US$2.60). Self-hosted alternatives like Karakeep and Wallabag are free but require running your own server.",
							},
						},
						{
							"@type": "Question",
							name: "Can I import my Omnivore data into Hutch?",
							acceptedAnswer: {
								"@type": "Answer",
								text: "Omnivore data import is on the Hutch roadmap. If you exported your data before the shutdown, hold onto that file. You can start using Hutch immediately with the browser extension.",
							},
						},
					],
				},
			],
		},
		styles: OMNIVORE_ALTERNATIVE_PAGE_STYLES,
		headerVariant: "transparent",
		bodyClass: "page-omnivore-alternative",
		content: render(OMNIVORE_TEMPLATE, {
			staticBaseUrl,
			browserName: browser,
			userCount,
			foundingMemberLimit: FOUNDING_MEMBER_LIMIT,
			progressPercent,
			allocationExhausted,
			coreFeatures: [
				{
					name: "Firefox & Chrome Extensions",
					description:
						"Save any page with one click, keyboard shortcut, or right-click menu.",
				},
				{
					name: "Reader View",
					description:
						"Clean article layout powered by Mozilla's readability engine. No distractions.",
				},
				{
					name: "TL;DR Summaries",
					description:
						"AI-generated summary per article highlighting the key points. Included in every plan.",
				},
				{
					name: "Web App",
					description:
						"Manage your reading list from any browser. No app store required.",
				},
				{
					name: "Auto Dark Mode",
					description:
						"Follows your system preference. No toggle hunting.",
				},
				{
					name: "Secure Auth",
					description:
						"OAuth with PKCE. Tokens stored locally in your browser.",
				},
				{
					name: "Full Data Export",
					description:
						"Export everything, anytime. Even after you cancel.",
				},
				{
					name: "Privacy First",
					description:
						"Hosted in Sydney. Australian Privacy Act. No tracking, no ads.",
				},
			],
		}, { helpers: switchHelpers }),
	});
}
