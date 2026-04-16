import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SavedArticle } from "../../../domain/article/article.types";
import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { render } from "../../render";
import { requireEnv } from "../../../require-env";
import { READER_STYLES } from "./reader.styles";

const STATIC_BASE_URL = requireEnv("STATIC_BASE_URL");

const NO_CONTENT_TEMPLATE = readFileSync(join(__dirname, "reader-no-content.template.html"), "utf-8");
const READER_CONTENT_TEMPLATE = readFileSync(join(__dirname, "reader-content.template.html"), "utf-8");
const READER_TEMPLATE = readFileSync(join(__dirname, "reader.template.html"), "utf-8");

function renderReaderContent(article: SavedArticle, options: { summary?: string | null; audioEnabled?: boolean }): string {
	if (!article.content) {
		return render(NO_CONTENT_TEMPLATE, { url: article.url });
	}

	return render(READER_CONTENT_TEMPLATE, {
		title: article.metadata.title,
		siteName: article.metadata.siteName,
		estimatedReadTime: article.estimatedReadTime,
		url: article.url,
		content: article.content,
		summary: options.summary ?? undefined,
		audioEnabled: options.audioEnabled,
		staticBaseUrl: STATIC_BASE_URL,
	});
}

export function ReaderPage(article: SavedArticle, options?: { emailVerified?: boolean; summary?: string | null; audioEnabled?: boolean }): Component {
	const content = render(READER_TEMPLATE, {
		innerContent: renderReaderContent(article, { summary: options?.summary, audioEnabled: options?.audioEnabled }),
	});

	return Base({
		seo: {
			title: `${article.metadata.title} — Readplace Reader`,
			description: article.metadata.excerpt,
			canonicalUrl: `/queue/${article.id.value}/read`,
			robots: "noindex, nofollow",
		},
		styles: READER_STYLES,
		bodyClass: "page-reader",
		content,
		isAuthenticated: true,
		emailVerified: options?.emailVerified,
	});
}
