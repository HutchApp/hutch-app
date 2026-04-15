import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CANONICAL_APP_ORIGIN, CANONICAL_EMBED_ORIGIN } from "./config";

const SNIPPETS_DIR = join(__dirname, "snippets");

export const SNIPPET_A = readFileSync(join(SNIPPETS_DIR, "snippet-a.html"), "utf-8");
export const SNIPPET_B = readFileSync(join(SNIPPETS_DIR, "snippet-b.html"), "utf-8");
export const SNIPPET_C = readFileSync(join(SNIPPETS_DIR, "snippet-c.html"), "utf-8");

export interface OriginSubstitution {
	appOrigin: string;
	embedOrigin: string;
}

export function substituteOrigins(snippet: string, origins: OriginSubstitution): string {
	return snippet
		.split(CANONICAL_APP_ORIGIN)
		.join(origins.appOrigin)
		.split(CANONICAL_EMBED_ORIGIN)
		.join(origins.embedOrigin);
}

export function byteLength(snippet: string): number {
	return Buffer.byteLength(snippet, "utf-8");
}
