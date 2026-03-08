import type { SavedArticle } from "../../../domain/article/article.types";
import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { render } from "../../render";
import { READER_STYLES } from "./reader.styles";

const NO_CONTENT_TEMPLATE = `
    <div class="reader__no-content" data-test-no-content>
      <h2 class="reader__no-content-title">Content not available</h2>
      <p class="reader__no-content-text">The article content could not be extracted when it was saved.</p>
      <a class="reader__no-content-link" href="{{url}}" target="_blank" rel="noopener">View original article</a>
    </div>`;

const READER_CONTENT_TEMPLATE = `
    <div class="reader__header">
      <a class="reader__back" href="/queue" data-test-back-link>← Back to queue</a>
      <h1 class="reader__title" data-test-reader-title>{{title}}</h1>
      <div class="reader__meta">
        <span data-test-reader-site>{{siteName}}</span>
        <span>{{estimatedReadTime}} min read</span>
      </div>
      <a class="reader__original-link" href="{{url}}" target="_blank" rel="noopener" data-test-original-link>View original</a>
    </div>
    <div class="reader__content" data-test-reader-content>
      {{{content}}}
    </div>`;

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
