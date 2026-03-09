import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { render } from "../../render";
import { LEGAL_PAGE_STYLES } from "../privacy/privacy.styles";

const TERMS_TEMPLATE = readFileSync(join(__dirname, "terms.template.html"), "utf-8");

export function TermsPage(): Component {
	return Base({
		seo: {
			title: "Terms of Service — Hutch",
			description:
				"Terms governing your use of the Hutch read-it-later service.",
			canonicalUrl: "https://hutch-app.com/terms",
			robots: "noindex, follow",
		},
		styles: LEGAL_PAGE_STYLES,
		bodyClass: "page-terms",
		content: render(TERMS_TEMPLATE, {}),
	});
}
