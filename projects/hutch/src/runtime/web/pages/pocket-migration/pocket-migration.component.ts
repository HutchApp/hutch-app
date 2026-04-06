import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { render } from "../../render";
import { GUIDE_PAGE_STYLES } from "./pocket-migration.styles";

/*
---
title: "How to Move Your Reading List from Pocket to Hutch"
description: "Pocket shut down July 8, 2025. Export your saved articles and import them into Hutch in four steps."
slug: "pocket-migration"
date: "2026-04-06"
author: "Fagner Brack"
keywords: "Pocket migration, Pocket export, Pocket alternative, move from Pocket, Pocket shut down"
---
*/

const post = {
	title: "How to Move Your Reading List from Pocket to Hutch",
	description: "Pocket shut down July 8, 2025. Export your saved articles and import them into Hutch in four steps.",
	slug: "pocket-migration",
	date: "2026-04-06",
	author: "Fagner Brack",
	keywords: "Pocket migration, Pocket export, Pocket alternative, move from Pocket, Pocket shut down",
};

const POCKET_MIGRATION_TEMPLATE = readFileSync(join(__dirname, "pocket-migration.template.html"), "utf-8");

export function PocketMigrationPage(): Component {
	return Base({
		seo: {
			title: `${post.title} — Hutch`,
			description: post.description,
			canonicalUrl: `https://hutch-app.com/${post.slug}`,
			ogType: "article",
			author: post.author,
			keywords: post.keywords,
			robots: "index, follow",
			structuredData: [
				{
					"@context": "https://schema.org",
					"@type": "BlogPosting",
					headline: post.title,
					description: post.description,
					datePublished: post.date,
					author: {
						"@type": "Person",
						name: post.author,
					},
					publisher: {
						"@type": "Organization",
						name: "Hutch",
						url: "https://hutch-app.com",
					},
					url: `https://hutch-app.com/${post.slug}`,
				},
			],
		},
		styles: GUIDE_PAGE_STYLES,
		bodyClass: "page-pocket-migration",
		content: render(POCKET_MIGRATION_TEMPLATE, {}),
	});
}
