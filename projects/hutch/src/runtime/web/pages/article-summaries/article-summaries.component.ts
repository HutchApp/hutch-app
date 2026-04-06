import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { render } from "../../render";
import { ARTICLE_SUMMARIES_STYLES } from "./article-summaries.styles";

const RAW_TEMPLATE = readFileSync(join(__dirname, "article-summaries.template.html"), "utf-8");

interface Frontmatter {
	title: string;
	description: string;
	slug: string;
	date: string;
	author: string;
	keywords: string;
}

function parseFrontmatter(raw: string): { frontmatter: Frontmatter; body: string } {
	const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
	assert(match, "Template missing frontmatter");

	const entries: Record<string, string> = {};
	for (const line of match[1].split("\n")) {
		const colonIndex = line.indexOf(": ");
		if (colonIndex === -1) continue;
		const key = line.slice(0, colonIndex).trim();
		const value = line.slice(colonIndex + 2).trim().replace(/^"|"$/g, "");
		entries[key] = value;
	}

	assert(entries.title, "Frontmatter missing title");
	assert(entries.description, "Frontmatter missing description");
	assert(entries.slug, "Frontmatter missing slug");
	assert(entries.date, "Frontmatter missing date");
	assert(entries.author, "Frontmatter missing author");
	assert(entries.keywords, "Frontmatter missing keywords");

	return {
		frontmatter: entries as unknown as Frontmatter,
		body: match[2],
	};
}

const { frontmatter, body: TEMPLATE } = parseFrontmatter(RAW_TEMPLATE);

export function ArticleSummariesPage(params: { staticBaseUrl: string }): Component {
	const { staticBaseUrl } = params;
	return Base({
		seo: {
			title: `${frontmatter.title} | Hutch`,
			description: frontmatter.description,
			canonicalUrl: `https://hutch-app.com/${frontmatter.slug}`,
			ogType: "article",
			ogImage: `${staticBaseUrl}/og-image-1200x630.png`,
			ogImageType: "image/png",
			ogImageAlt:
				"Hutch: save articles, get AI summaries, read what matters.",
			twitterImage: `${staticBaseUrl}/twitter-card-1200x600.png`,
			author: frontmatter.author,
			keywords: frontmatter.keywords,
			robots: "index, follow",
			structuredData: [
				{
					"@context": "https://schema.org",
					"@type": "BlogPosting",
					headline: frontmatter.title,
					description: frontmatter.description,
					datePublished: frontmatter.date,
					author: {
						"@type": "Person",
						name: frontmatter.author,
						url: "https://www.linkedin.com/in/fagnerbrack/",
					},
					publisher: {
						"@type": "Organization",
						name: "Hutch",
						url: "https://hutch-app.com",
					},
					url: `https://hutch-app.com/${frontmatter.slug}`,
				},
			],
		},
		styles: ARTICLE_SUMMARIES_STYLES,
		headerVariant: "transparent",
		bodyClass: "page-article-summaries",
		content: render(TEMPLATE, { staticBaseUrl }),
	});
}
