import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CANONICAL_APP_ORIGIN, CANONICAL_EMBED_ORIGIN } from "./config";
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

const CANONICAL_ORIGINS: SnippetOrigins = {
	appOrigin: CANONICAL_APP_ORIGIN,
	embedOrigin: CANONICAL_EMBED_ORIGIN,
};

export function renderSnippet(variant: SnippetVariant, origins: SnippetOrigins): string {
	return render(SNIPPET_TEMPLATES[variant], origins);
}

export function renderCanonicalSnippet(variant: SnippetVariant): string {
	return renderSnippet(variant, CANONICAL_ORIGINS);
}

export function byteLength(snippet: string): number {
	return Buffer.byteLength(snippet, "utf-8");
}
