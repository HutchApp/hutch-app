import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { render } from "../../render";
import { switchHelpers } from "../../handlebars-switch";
import { OMNIVORE_ALTERNATIVE_PAGE_STYLES } from "./omnivore-alternative.styles";

const OMNIVORE_TEMPLATE = readFileSync(join(__dirname, "omnivore-alternative.template.html"), "utf-8");

const FOUNDING_MEMBER_LIMIT = 100;

/*
---
title: "Omnivore Shut Down. Here's a Read-It-Later App That Won't."
description: "Omnivore shut down with two weeks notice. Hutch is a privacy-first read-it-later app built by a developer, with AGPL source code and no VC funding."
slug: "omnivore-alternative"
date: "2026-04-06"
author: "Fagner Brack"
keywords: "Omnivore alternative, Omnivore replacement, Omnivore shut down, read it later app, Omnivore shutdown, ElevenLabs Omnivore, save articles, AGPL read it later, privacy first bookmark manager, Readwise Reader alternative"
---
*/

const POST_METADATA = {
	title: "Omnivore Shut Down. Here's a Read-It-Later App That Won't.",
	description:
		"Omnivore shut down with two weeks notice. Hutch is a privacy-first read-it-later app built by a developer, with AGPL source code and no VC funding.",
	slug: "omnivore-alternative",
	date: "2026-04-06",
	author: "Fagner Brack",
	keywords:
		"Omnivore alternative, Omnivore replacement, Omnivore shut down, read it later app, Omnivore shutdown, ElevenLabs Omnivore, save articles, AGPL read it later, privacy first bookmark manager, Readwise Reader alternative",
};

export function OmnivoreAlternativePage(params: { userCount: number; staticBaseUrl: string; browser: "firefox" | "chrome" | "other" }): Component {
	const { userCount, staticBaseUrl, browser } = params;
	const progressPercent = Math.min(Math.round((userCount / FOUNDING_MEMBER_LIMIT) * 100), 100);
	const allocationExhausted = userCount >= FOUNDING_MEMBER_LIMIT;
	return Base({
		seo: {
			title: `${POST_METADATA.title} | Hutch`,
			description: POST_METADATA.description,
			canonicalUrl: `https://hutch-app.com/${POST_METADATA.slug}`,
			ogType: "article",
			ogImage: `${staticBaseUrl}/og-image-1200x630.png`,
			ogImageType: "image/png",
			ogImageAlt:
				"Hutch: a read-it-later app and Omnivore alternative. Save articles, read them later.",
			twitterImage: `${staticBaseUrl}/twitter-card-1200x600.png`,
			author: POST_METADATA.author,
			keywords: POST_METADATA.keywords,
			structuredData: [
				{
					"@context": "https://schema.org",
					"@type": "BlogPosting",
					headline: POST_METADATA.title,
					description: POST_METADATA.description,
					datePublished: POST_METADATA.date,
					url: `https://hutch-app.com/${POST_METADATA.slug}`,
					author: {
						"@type": "Person",
						name: POST_METADATA.author,
						url: "https://www.linkedin.com/in/fagnerbrack/",
					},
					publisher: {
						"@type": "Organization",
						name: "Hutch",
						url: "https://hutch-app.com",
						logo: {
							"@type": "ImageObject",
							url: `${staticBaseUrl}/og-image-1200x630.png`,
						},
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
								text: "ElevenLabs acquired Omnivore on November 1, 2024, and shut it down on November 15. Users had about two weeks to export their data before deletion began. The open-source repository was archived. Omnivore is not coming back.",
							},
						},
						{
							"@type": "Question",
							name: "Is there a free Omnivore alternative?",
							acceptedAnswer: {
								"@type": "Answer",
								text: "Hutch is free for the first 100 founding members with full access forever. After that, A$3.99/month (about US$2.60). Self-hosted alternatives like Karakeep and Wallabag are free but require running your own server.",
							},
						},
						{
							"@type": "Question",
							name: "Can I import my Omnivore data into Hutch?",
							acceptedAnswer: {
								"@type": "Answer",
								text: "Omnivore data import is on the Hutch roadmap. If you exported your data before the shutdown, keep that file. You can start using Hutch right now with the browser extension.",
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
						"Save any page with one click, a keyboard shortcut, or the right-click menu.",
				},
				{
					name: "Reader View",
					description:
						"Clean article layout powered by Mozilla's readability engine. No clutter.",
				},
				{
					name: "TL;DR Summaries",
					description:
						"AI-generated summary per article. Key points in seconds. Included in every plan.",
				},
				{
					name: "Web App",
					description:
						"Manage your reading list from any browser. No app store needed.",
				},
				{
					name: "Auto Dark Mode",
					description:
						"Matches your system preference. No toggle required.",
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
						"Hosted in Sydney. Australian Privacy Act. No tracking. No ads.",
				},
			],
		}, { helpers: switchHelpers }),
	});
}
