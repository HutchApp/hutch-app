import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { render } from "../../render";

const TEMPLATE = readFileSync(join(__dirname, "e2e-fixture.template.html"), "utf-8");

export function E2EFixturePage(): Component {
	return Base({
		seo: {
			title: "Readplace E2E test fixture article",
			description: "Static fixture used by Readplace's end-to-end tests against staging.",
			canonicalUrl: "https://readplace.com/e2e/article/",
			robots: "noindex, nofollow",
		},
		styles: "",
		content: render(TEMPLATE, {}),
	});
}
