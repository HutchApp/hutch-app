import { readFileSync } from "node:fs";
import { join } from "node:path";
import Handlebars from "handlebars";
import { Base } from "./base.component";
import type { Component } from "./component.types";
import { CANONICAL_EMBED_ORIGIN } from "./config";
import { EMBED_PAGE_STYLES } from "./embed.styles";
import { render } from "./render";
import { CANONICAL_ORIGINS, type SnippetVariant, byteLength, renderSnippet } from "./snippet.component";

const EMBED_TEMPLATE = readFileSync(join(__dirname, "embed.template.html"), "utf-8");

function isValidUrl(raw: string): boolean {
	try {
		new URL(raw);
		return true;
	} catch {
		return false;
	}
}

const HTMX_SCRIPT = '<script src="https://cdn.jsdelivr.net/npm/htmx.org@2.0.8/dist/htmx.min.js" integrity="sha384-/TgkGk7p307TH7EXJDuUlgG3Ce1UVolAOFopFekQkkXihi5u/6OCvVKyz1W+idaz" crossorigin="anonymous"></script>';

const COPY_SCRIPT = `<script>
(function() {
  var buttons = document.querySelectorAll('[data-copy]');
  for (var i = 0; i < buttons.length; i++) {
    (function(btn) {
      btn.addEventListener('click', function() {
        var target = document.getElementById(btn.getAttribute('data-copy'));
        if (!target) return;
        navigator.clipboard.writeText(target.textContent || '').then(function() {
          var original = btn.textContent;
          btn.textContent = 'Copied';
          setTimeout(function() { btn.textContent = original; }, 1500);
        });
      });
    })(buttons[i]);
  }
})();
</script>`;

export interface EmbedPageInput {
	appOrigin: string;
	embedOrigin: string;
	articleUrl?: string;
}

function highlightedSource(variant: SnippetVariant, encodedUrl: string): string {
	const snippet = renderSnippet(variant, { ...CANONICAL_ORIGINS, pageUrl: encodedUrl });
	const escaped = Handlebars.Utils.escapeExpression(snippet);
	return escaped.replace(
		encodedUrl,
		`<mark class="embed-variant__url-highlight">${encodedUrl}</mark>`,
	);
}

export function EmbedPage(input: EmbedPageInput): Component {
	const articleUrl = input.articleUrl && isValidUrl(input.articleUrl) ? input.articleUrl : undefined;

	const heroOrigins = { appOrigin: input.appOrigin, embedOrigin: input.embedOrigin, pageUrl: `${input.embedOrigin}/` };
	// The hero demo is snippet B with the embed page's own URL filled in,
	// proving the save flow works end-to-end when a reader clicks it.
	const heroDemo = renderSnippet("b", heroOrigins);

	let variantData = {};
	if (articleUrl) {
		const encodedUrl = encodeURIComponent(articleUrl);
		const previewOrigins = { appOrigin: input.appOrigin, embedOrigin: input.embedOrigin, pageUrl: articleUrl };
		const sourceA = highlightedSource("a", encodedUrl);
		const sourceB = highlightedSource("b", encodedUrl);
		const sourceC = highlightedSource("c", encodedUrl);
		variantData = {
			hasUrl: true,
			previewA: renderSnippet("a", previewOrigins),
			previewB: renderSnippet("b", previewOrigins),
			previewC: renderSnippet("c", previewOrigins),
			snippetA: sourceA,
			snippetB: sourceB,
			snippetC: sourceC,
			bytesA: byteLength(renderSnippet("a", { ...CANONICAL_ORIGINS, pageUrl: encodedUrl })),
			bytesB: byteLength(renderSnippet("b", { ...CANONICAL_ORIGINS, pageUrl: encodedUrl })),
			bytesC: byteLength(renderSnippet("c", { ...CANONICAL_ORIGINS, pageUrl: encodedUrl })),
		};
	}

	const content = render(EMBED_TEMPLATE, {
		heroDemo,
		articleUrl: articleUrl ?? "",
		...variantData,
		appOrigin: input.appOrigin,
	});

	return Base({
		seo: {
			title: "Readplace embed kit — a save button for your readers",
			description:
				"A copy-paste save button for bloggers and newsletter operators. Under 1 KB, no JavaScript, no tracking.",
			canonicalUrl: `${CANONICAL_EMBED_ORIGIN}/`,
		},
		pageStyles: EMBED_PAGE_STYLES,
		bodyClass: "page-embed",
		content,
		scripts: `${HTMX_SCRIPT}${COPY_SCRIPT}`,
		appOrigin: input.appOrigin,
	});
}
