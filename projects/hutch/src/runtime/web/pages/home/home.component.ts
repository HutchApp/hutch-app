import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { render } from "../../render";
import { HOME_PAGE_STYLES } from "./home.styles";
import type { FeatureId, FeatureVoteSummary } from "../../../providers/feature-vote/feature-vote.types";

const HOME_TEMPLATE = readFileSync(join(__dirname, "home.template.html"), "utf-8");

const FOUNDING_MEMBER_LIMIT = 100;

export const PLANNED_FEATURE_IDS: FeatureId[] = [
	"email-link-import" as FeatureId,
	"ai-queue-filter" as FeatureId,
	"highlights-notes" as FeatureId,
	"full-text-search" as FeatureId,
	"offline-reading" as FeatureId,
	"text-to-speech" as FeatureId,
	"newsletter-inbox" as FeatureId,
];

interface PlannedFeatureDefinition {
	id: FeatureId;
	name: string;
	description: string;
}

const PLANNED_FEATURES: PlannedFeatureDefinition[] = [
	{
		id: "email-link-import" as FeatureId,
		name: "Email Link Import",
		description: "Import links from your email to Hutch queue",
	},
	{
		id: "ai-queue-filter" as FeatureId,
		name: "Filter your queue using AI based on your preferences",
		description: "Allow Hutch to select the most relevant links for you based on your goals",
	},
	{
		id: "highlights-notes" as FeatureId,
		name: "Highlights & Notes",
		description: "Highlight in multiple colours, add inline notes, export as Markdown.",
	},
	{
		id: "full-text-search" as FeatureId,
		name: "Full-Text Search",
		description: "Search across titles and article body text. Filter by tags, read status, and date.",
	},
	{
		id: "offline-reading" as FeatureId,
		name: "Offline Reading",
		description: "Articles auto-download for offline access. Your queue persists even if the original page disappears.",
	},
	{
		id: "text-to-speech" as FeatureId,
		name: "Text-to-Speech",
		description: "Listen to articles with natural TTS. Adjustable speed, background playback.",
	},
	{
		id: "newsletter-inbox" as FeatureId,
		name: "Newsletter Inbox",
		description: "Unique email alias routes newsletters straight into your reading queue.",
	},
];

export function HomePage(params: {
	userCount: number;
	staticBaseUrl: string;
	isLoggedIn: boolean;
	voteSummaries: FeatureVoteSummary[];
}): Component {
	const { userCount, staticBaseUrl, isLoggedIn, voteSummaries } = params;
	const progressPercent = Math.min(Math.round((userCount / FOUNDING_MEMBER_LIMIT) * 100), 100);
	const allocationExhausted = userCount >= FOUNDING_MEMBER_LIMIT;
	return Base({
		seo: {
			title: "Hutch — You are what you read.",
			description:
				"Read the web, not the slop. Hutch is a read-it-later app built from a 10-year personal reading system. Save articles, read them in a clean reader view, and organise your reading list. Built in Australia by a solo developer.",
			canonicalUrl: "https://hutch-app.com",
			ogType: "website",
			ogImage: `${staticBaseUrl}/og-image-1200x630.png`,
			ogImageType: "image/png",
			ogImageAlt:
				"Hutch — You are what you read. A read-it-later app built in Australia.",
			twitterImage: `${staticBaseUrl}/twitter-card-1200x600.png`,
				author: "Fayner Brack",
			keywords:
				"read it later, save articles, bookmark manager, reading list, Pocket alternative, Omnivore alternative, browser extension, Firefox extension, Chrome extension, article reader, distraction free reading, AI summaries",
			structuredData: [
				{
					"@context": "https://schema.org",
					"@type": "WebApplication",
					name: "Hutch",
					url: "https://hutch-app.com",
					description:
						"You are what you read. A read-it-later app built from a 10-year personal reading system. Save articles, read them later.",
					applicationCategory: "ProductivityApplication",
					operatingSystem: "Web, iOS, Android",
					browserRequirements: "Requires Firefox or Chrome for browser extension",
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
						"One-click article saving via browser extension",
						"Web app for managing saved articles",
						"Distraction-free reader view with clean typography",
					],
				},
				{
					"@context": "https://schema.org",
					"@type": "Organization",
					name: "Hutch",
					url: "https://hutch-app.com",
					logo: `${staticBaseUrl}/og-image-1200x630.png`,
					sameAs: [
						"https://www.linkedin.com/in/fagnerbrack/",
					],
					founder: {
						"@type": "Person",
						name: "Fayner Brack",
					},
					description:
						"You are what you read. Hutch is a read-it-later app built in Australia by a solo developer.",
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
								text: "Hutch is a read-it-later app built from a 10-year personal reading system. Save articles with one click using the browser extension for Firefox or Chrome, read them in a clean reader view, and get TL;DR summaries for every article.",
							},
						},
						{
							"@type": "Question",
							name: "Is Hutch free?",
							acceptedAnswer: {
								"@type": "Answer",
								text: "The first 100 founding members get full access free, forever. After that, A$3.99/month — includes TL;DR summaries. Personalised AI summaries require a BYOK API key (Anthropic or OpenAI).",
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
								text: "Hutch offers browser extensions for Firefox and Chrome, a web app for managing saved articles, a distraction-free reader view, TL;DR summaries, dark mode, and secure OAuth with PKCE. Planned features include personalised AI summaries (BYOK), preference learning, Gmail integration, and highlights and notes.",
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
			staticBaseUrl,
			userCount,
			foundingMemberLimit: FOUNDING_MEMBER_LIMIT,
			progressPercent,
			allocationExhausted,
			isLoggedIn,
			coreFeatures: [
				{
					name: "Firefox Extension",
					description:
						"Save any page with one click, Ctrl/Cmd+D, or right-click.",
				},
				{
					name: "Chrome Extension",
					description:
						"Same one-click saving, now available in Chrome.",
				},
				{
					name: "Reader View",
					description:
						"Clean article view powered by Readability.js. No distractions.",
				},
				{
					name: "Web App",
					description:
						"Manage and organise your reading list from any browser.",
				},
				{
					name: "TL;DR Summaries",
					description:
						"One-line summary per article, generated once, available to all users.",
				},
				{
					name: "Dark Mode",
					description:
						"Follows your system preference automatically.",
				},
				{
					name: "Secure Auth",
					description:
						"OAuth with PKCE. Tokens stored locally in your browser, not on a server.",
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
			plannedFeatures: PLANNED_FEATURES.map((feature) => {
				const summary = voteSummaries.find((s) => s.featureId === feature.id);
				const voteCount = summary?.voteCount ?? 0;
				return {
					...feature,
					voteCount,
					hasVoted: summary?.hasVoted ?? false,
					voteCountIsOne: voteCount === 1,
				};
			}),
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
