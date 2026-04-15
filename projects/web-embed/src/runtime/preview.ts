import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderBase } from "./base";
import { PREVIEW_PAGE_STYLES } from "./preview.styles";
import { render } from "./render";
import { SNIPPET_A, SNIPPET_B, SNIPPET_C, substituteOrigins } from "./snippets";

const PREVIEW_TEMPLATE = readFileSync(join(__dirname, "preview.template.html"), "utf-8");

export interface PreviewPageInput {
	appOrigin: string;
	embedOrigin: string;
}

export function renderPreviewPage(input: PreviewPageInput): string {
	const origins = { appOrigin: input.appOrigin, embedOrigin: input.embedOrigin };
	const content = render(PREVIEW_TEMPLATE, {
		previewA: substituteOrigins(SNIPPET_A, origins),
		previewB: substituteOrigins(SNIPPET_B, origins),
		previewC: substituteOrigins(SNIPPET_C, origins),
	});

	return renderBase({
		seo: {
			title: "Embed preview — Readplace embed kit",
			description: "Developer tool for previewing Readplace embed variants against multiple backgrounds.",
			canonicalUrl: `${input.embedOrigin}/preview`,
			robots: "noindex, nofollow",
		},
		pageStyles: PREVIEW_PAGE_STYLES,
		bodyClass: "page-embed-preview",
		content,
		appOrigin: input.appOrigin,
	});
}
