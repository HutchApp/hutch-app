import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { render } from "../../render";
import { GMAIL_IMPORT_STYLES } from "./gmail-import.styles";
import type { GmailImportViewModel } from "./gmail-import.viewmodel";

const GMAIL_IMPORT_TEMPLATE = readFileSync(join(__dirname, "gmail-import.template.html"), "utf-8");

export function GmailImportPage(vm: GmailImportViewModel, options?: { emailVerified?: boolean }): Component {
	return Base({
		seo: {
			title: "Gmail Import — Hutch",
			description: "Import links from your Gmail emails into your Hutch reading queue.",
			canonicalUrl: "/gmail-import",
			robots: "noindex, nofollow",
		},
		styles: GMAIL_IMPORT_STYLES,
		bodyClass: "page-gmail-import",
		content: render(GMAIL_IMPORT_TEMPLATE, vm),
		isAuthenticated: true,
		emailVerified: options?.emailVerified,
	});
}
