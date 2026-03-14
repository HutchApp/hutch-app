import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SavedArticle } from "../../../domain/article/article.types";
import type { PageBody } from "../../base.component";
import { render } from "../../render";
import { READER_STYLES } from "./reader.styles";

const NO_CONTENT_TEMPLATE = readFileSync(join(__dirname, "reader-no-content.template.html"), "utf-8");
const READER_CONTENT_TEMPLATE = readFileSync(join(__dirname, "reader-content.template.html"), "utf-8");
const READER_TEMPLATE = readFileSync(join(__dirname, "reader.template.html"), "utf-8");

function renderReaderContent(article: SavedArticle): string {
	if (!article.content) {
		return render(NO_CONTENT_TEMPLATE, { url: article.url });
	}

	return render(READER_CONTENT_TEMPLATE, {
		title: article.metadata.title,
		siteName: article.metadata.siteName,
		estimatedReadTime: article.estimatedReadTime,
		url: article.url,
		content: article.content,
	});
}

export function ReaderPage(article: SavedArticle): PageBody {
	const content = render(READER_TEMPLATE, {
		innerContent: renderReaderContent(article),
	});

	return {
		seo: {
			title: `${article.metadata.title} — Hutch Reader`,
			description: article.metadata.excerpt,
			canonicalUrl: `/queue/${article.id}/read`,
			robots: "noindex, nofollow",
		},
		styles: READER_STYLES,
		bodyClass: "page-reader",
		content,
	};
}
