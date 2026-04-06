import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { render } from "../../render";
import { ARTICLE_SUMMARIES_STYLES } from "./article-summaries.styles";

const TEMPLATE = readFileSync(join(__dirname, "article-summaries.template.html"), "utf-8");

export function ArticleSummariesPage(params: { staticBaseUrl: string }): Component {
	const { staticBaseUrl } = params;
	return Base({
		seo: {
			title: "Read Later with AI Summary | Hutch",
			description:
				"Save articles with one click, get AI TL;DR summaries automatically. A$3.99/mo. Privacy-first. Built by the creator of js-cookie.",
			canonicalUrl: "https://hutch-app.com/article-summaries",
			ogType: "website",
			ogImage: `${staticBaseUrl}/og-image-1200x630.png`,
			ogImageType: "image/png",
			ogImageAlt:
				"Hutch — Save articles, get AI summaries, read what matters.",
			twitterImage: `${staticBaseUrl}/twitter-card-1200x600.png`,
			author: "Fayner Brack",
			keywords:
				"AI article summary, read later app, TL;DR summary, save articles, AI reading assistant, article summarizer, Pocket alternative",
			structuredData: [
				{
					"@context": "https://schema.org",
					"@type": "WebPage",
					name: "Read Later with AI Summary",
					url: "https://hutch-app.com/article-summaries",
					description:
						"Save articles with one click, get AI TL;DR summaries automatically. A$3.99/mo. Privacy-first. Built by the creator of js-cookie.",
					isPartOf: {
						"@type": "WebSite",
						name: "Hutch",
						url: "https://hutch-app.com",
					},
				},
			],
		},
		styles: ARTICLE_SUMMARIES_STYLES,
		headerVariant: "transparent",
		bodyClass: "page-article-summaries",
		content: render(TEMPLATE, { staticBaseUrl }),
	});
}
