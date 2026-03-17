import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { render } from "../../render";
import { LEGAL_PAGE_STYLES } from "./privacy.styles";

const PRIVACY_TEMPLATE = readFileSync(join(__dirname, "privacy.template.html"), "utf-8");

export function PrivacyPage(): Component {
	return Base({
		seo: {
			title: "Privacy Policy — Hutch",
			description:
				"How Hutch handles your data. Hutch collects only what's necessary to run the service and never sells your information.",
			canonicalUrl: "https://hutch-app.com/privacy",
			robots: "noindex, follow",
		},
		styles: LEGAL_PAGE_STYLES,
		bodyClass: "page-privacy",
		content: render(PRIVACY_TEMPLATE, {}),
	});
}
