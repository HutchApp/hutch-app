import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { NOT_FOUND_STYLES } from "./not-found.styles";

const NOT_FOUND_TEMPLATE = readFileSync(join(__dirname, "not-found.template.html"), "utf-8");

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
		content: NOT_FOUND_TEMPLATE,
	});
}
