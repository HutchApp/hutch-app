import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { NOT_FOUND_STYLES } from "./not-found.styles";

export function NotFoundPage(): Component {
	return Base({
		seo: {
			title: "Page Not Found — Hutch",
			description: "The page you are looking for does not exist.",
			canonicalUrl: "https://hutch-app.com",
			robots: "noindex, nofollow",
		},
		styles: NOT_FOUND_STYLES,
		bodyClass: "page-not-found",
		content: `
    <main class="not-found">
      <div class="not-found__container">
        <h1 class="not-found__title">Page not found</h1>
        <p class="not-found__text">The page you are looking for does not exist or has been moved.</p>
        <a href="/" class="not-found__link">Go to homepage</a>
      </div>
    </main>`,
	});
}
