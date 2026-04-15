import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Base } from "../../base.component";
import type { Component } from "../../component.types";
import { render } from "../../render";
import { SAVE_FAILED_STYLES } from "./save-failed.styles";

const SAVE_FAILED_TEMPLATE = readFileSync(join(__dirname, "save-failed.template.html"), "utf-8");

interface SaveFailedPageInput {
	queryUrl: string;
	referer: string;
}

export function SaveFailedPage(input: SaveFailedPageInput): Component {
	return Base({
		seo: {
			title: "Save failed — Readplace",
			description: "Readplace couldn't save the article because the request and referrer URLs disagreed.",
			canonicalUrl: "https://readplace.com/save",
			robots: "noindex, nofollow",
		},
		styles: SAVE_FAILED_STYLES,
		bodyClass: "page-save-failed",
		content: render(SAVE_FAILED_TEMPLATE, {
			queryUrl: input.queryUrl,
			queryUrlHref: `/save?url=${encodeURIComponent(input.queryUrl)}`,
			referer: input.referer,
			refererHref: `/save?url=${encodeURIComponent(input.referer)}`,
		}),
	});
}
