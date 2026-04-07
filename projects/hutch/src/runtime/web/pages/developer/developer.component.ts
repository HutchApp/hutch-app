import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { render } from "../../render";
import { switchHelpers } from "../../handlebars-switch";
import { DEVELOPER_PAGE_STYLES } from "./developer.styles";

const DEVELOPER_TEMPLATE = readFileSync(join(__dirname, "developer.template.html"), "utf-8");

const FOUNDING_MEMBER_LIMIT = 100;

export function DeveloperPage(params: { userCount: number; staticBaseUrl: string; browser: "firefox" | "chrome" | "other" }): Component {
	const { userCount, staticBaseUrl, browser } = params;
	const progressPercent = Math.min(Math.round((userCount / FOUNDING_MEMBER_LIMIT) * 100), 100);
	const allocationExhausted = userCount >= FOUNDING_MEMBER_LIMIT;
	return Base({
		seo: {
			title: "Hutch for Developers — Save Technical Reading",
			description:
				"A read-it-later app built by the creator of js-cookie. Save blog posts, GitHub READMs, HN threads. AI TL;DR for triage. AGPL source-available. Hosted in Sydney.",
			canonicalUrl: "https://hutch-app.com/developer",
			ogType: "website",
			ogImage: `${staticBaseUrl}/og-image-1200x630.png`,
			ogImageType: "image/png",
			ogImageAlt:
				"Hutch — A read-it-later app built by a developer who reads.",
			twitterImage: `${staticBaseUrl}/twitter-card-1200x600.png`,
			author: "Fayner Brack",
			keywords:
				"developer reading list, save articles, technical reading, read it later, AGPL, open source, js-cookie, Pocket alternative, privacy first, browser extension",
		},
		styles: DEVELOPER_PAGE_STYLES,
		headerVariant: "transparent",
		bodyClass: "page-developer",
		content: render(DEVELOPER_TEMPLATE, {
			staticBaseUrl,
			browserName: browser,
			userCount,
			foundingMemberLimit: FOUNDING_MEMBER_LIMIT,
			progressPercent,
			allocationExhausted,
		}, { helpers: switchHelpers }),
	});
}
