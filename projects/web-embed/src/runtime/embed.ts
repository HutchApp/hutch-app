import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderBase } from "./base";
import { CANONICAL_EMBED_ORIGIN } from "./config";
import { EMBED_PAGE_STYLES } from "./embed.styles";
import { render } from "./render";
import { SNIPPET_A, SNIPPET_B, SNIPPET_C, byteLength, substituteOrigins } from "./snippets";

const EMBED_TEMPLATE = readFileSync(join(__dirname, "embed.template.html"), "utf-8");

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
}

export function renderEmbedPage(input: EmbedPageInput): string {
	const origins = { appOrigin: input.appOrigin, embedOrigin: input.embedOrigin };
	const previewA = substituteOrigins(SNIPPET_A, origins);
	const previewB = substituteOrigins(SNIPPET_B, origins);
	const previewC = substituteOrigins(SNIPPET_C, origins);

	const content = render(EMBED_TEMPLATE, {
		// The hero demo is literally the unmodified preview of snippet B — same HTML, same Referer-based
		// save flow. Clicking it saves the embed page itself, proving the snippet works end-to-end.
		heroDemo: previewB,
		previewA,
		previewB,
		previewC,
		snippetA: SNIPPET_A,
		snippetB: SNIPPET_B,
		snippetC: SNIPPET_C,
		bytesA: byteLength(SNIPPET_A),
		bytesB: byteLength(SNIPPET_B),
		bytesC: byteLength(SNIPPET_C),
		appOrigin: input.appOrigin,
	});

	return renderBase({
		seo: {
			title: "Readplace embed kit — a save button for your readers",
			description:
				"A copy-paste save button for bloggers and newsletter operators. Under 1 KB, no JavaScript, no tracking.",
			canonicalUrl: `${CANONICAL_EMBED_ORIGIN}/`,
		},
		pageStyles: EMBED_PAGE_STYLES,
		bodyClass: "page-embed",
		content,
		scripts: COPY_SCRIPT,
		appOrigin: input.appOrigin,
	});
}
