import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Component } from "./component.types";
import { CANONICAL_APP_ORIGIN, CANONICAL_EMBED_ORIGIN } from "./config";
import { HtmlPage } from "./html-page";
import { render } from "./render";

const SNIPPETS_DIR = join(__dirname, "snippets");

export type SnippetVariant = "a" | "b" | "c";

const SNIPPET_TEMPLATES: Record<SnippetVariant, string> = {
	a: readFileSync(join(SNIPPETS_DIR, "snippet-a.template.html"), "utf-8"),
	b: readFileSync(join(SNIPPETS_DIR, "snippet-b.template.html"), "utf-8"),
	c: readFileSync(join(SNIPPETS_DIR, "snippet-c.template.html"), "utf-8"),
};

export interface SnippetOrigins {
	appOrigin: string;
	embedOrigin: string;
}

export const CANONICAL_ORIGINS: SnippetOrigins = {
	appOrigin: CANONICAL_APP_ORIGIN,
	embedOrigin: CANONICAL_EMBED_ORIGIN,
};

export function renderSnippet(variant: SnippetVariant, origins: SnippetOrigins): string {
	return render(SNIPPET_TEMPLATES[variant], origins);
}

export function renderCanonicalSnippet(variant: SnippetVariant): string {
	return renderSnippet(variant, CANONICAL_ORIGINS);
}

export interface SnippetComponentInput {
	variant: SnippetVariant;
	origins: SnippetOrigins;
}

export function SnippetComponent(input: SnippetComponentInput): Component {
	return HtmlPage(renderSnippet(input.variant, input.origins));
}

export function byteLength(snippet: string): number {
	return Buffer.byteLength(snippet, "utf-8");
}
