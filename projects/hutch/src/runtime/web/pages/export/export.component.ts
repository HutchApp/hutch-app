import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { render } from "../../render";
import { EXPORT_STYLES } from "./export.styles";

const EXPORT_TEMPLATE = readFileSync(join(__dirname, "export.template.html"), "utf-8");

export function ExportPage(options?: { emailVerified?: boolean }): Component {
	return Base({
		seo: {
			title: "Export Your Data — Readplace",
			description: "Download all your saved articles and data from Readplace.",
			canonicalUrl: "/export",
			robots: "noindex, nofollow",
		},
		styles: EXPORT_STYLES,
		bodyClass: "page-export",
		content: render(EXPORT_TEMPLATE, {}),
		isAuthenticated: true,
		emailVerified: options?.emailVerified,
	});
}
