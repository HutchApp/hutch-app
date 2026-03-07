import type { SavedArticle } from "../../../domain/article/article.types";
import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { READER_STYLES } from "./reader.styles";

function renderReaderContent(article: SavedArticle): string {
	if (!article.content) {
		return `
    <div class="reader__no-content" data-test-no-content>
      <h2 class="reader__no-content-title">Content not available</h2>
      <p class="reader__no-content-text">The article content could not be extracted when it was saved.</p>
      <a class="reader__no-content-link" href="${article.url}" target="_blank" rel="noopener">View original article</a>
    </div>`;
	}

	return `
    <div class="reader__header">
      <a class="reader__back" href="/queue" data-test-back-link>← Back to queue</a>
      <h1 class="reader__title" data-test-reader-title>${article.metadata.title}</h1>
      <div class="reader__meta">
        <span data-test-reader-site>${article.metadata.siteName}</span>
        <span>${article.estimatedReadTime} min read</span>
      </div>
      <a class="reader__original-link" href="${article.url}" target="_blank" rel="noopener" data-test-original-link>View original</a>
    </div>
    <div class="reader__content" data-test-reader-content>
      ${article.content}
    </div>`;
}

export function ReaderPage(article: SavedArticle): Component {
	const content = `
    <main class="reader">
      ${renderReaderContent(article)}
    </main>`;

	return Base({
		seo: {
			title: `${article.metadata.title} — Hutch Reader`,
			description: article.metadata.excerpt,
			canonicalUrl: `/queue/${article.id}/read`,
			robots: "noindex, nofollow",
		},
		styles: READER_STYLES,
		bodyClass: "page-reader",
		content,
		isAuthenticated: true,
	});
}
