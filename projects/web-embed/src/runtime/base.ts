import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BASE_STYLES } from "./base.styles";
import { render } from "./render";

const BASE_TEMPLATE = readFileSync(join(__dirname, "base.template.html"), "utf-8");

export interface SeoMetadata {
	title: string;
	description: string;
	canonicalUrl: string;
	robots?: string;
}

export interface BaseLayoutInput {
	seo: SeoMetadata;
	pageStyles: string;
	bodyClass: string;
	content: string;
	scripts?: string;
	appOrigin: string;
}

export function renderBase(input: BaseLayoutInput): string {
	return render(BASE_TEMPLATE, {
		title: input.seo.title,
		description: input.seo.description,
		canonicalUrl: input.seo.canonicalUrl,
		robots: input.seo.robots ?? "index, follow",
		baseStyles: BASE_STYLES,
		pageStyles: input.pageStyles,
		bodyClass: input.bodyClass,
		content: input.content,
		scripts: input.scripts ?? "",
		appOrigin: input.appOrigin,
	});
}
