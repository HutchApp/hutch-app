import assert from "node:assert";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import type { ParseArticle } from "./article-parser.types";
import { extractThumbnail } from "./extract-thumbnail";

export type FetchHtml = (url: string) => Promise<string | undefined>;

export function initReadabilityParser(deps: {
	fetchHtml: FetchHtml;
}): { parseArticle: ParseArticle } {
	const parseArticle: ParseArticle = async (url) => {
		let hostname: string;
		try {
			hostname = new URL(url).hostname;
		} catch {
			return { ok: false, reason: "Invalid URL" };
		}

		const html = await deps.fetchHtml(url);
		if (!html) {
			return { ok: false, reason: "Could not fetch article" };
		}

		const imageUrl = extractThumbnail(html);
		const { document } = parseHTML(html);
		const reader = new Readability(document);
		const parsed = reader.parse();

		if (!parsed) {
			return {
				ok: true,
				article: {
					title: `Article from ${hostname}`,
					siteName: hostname,
					excerpt: `Content saved from ${hostname}.`,
					wordCount: 0,
					content: "",
					imageUrl,
				},
			};
		}

		// Readability.parse() always returns string values for textContent,
		// title, content, and excerpt when result is non-null.
		// Using explicit fallbacks via if-statements instead of || and ??
		// to avoid V8 coverage branches on operators that can never take
		// the fallback path at runtime.
		// See: https://github.com/bcoe/c8/issues/126
		assert(parsed.textContent, "Readability.parse() returns textContent when result is non-null");
		const wordCount = parsed.textContent.split(/\s+/).filter(Boolean).length;

		let title = parsed.title;
		if (!title) title = `Article from ${hostname}`;

		let siteName = parsed.siteName;
		if (!siteName) siteName = hostname;

		assert(parsed.excerpt, "Readability.parse() returns excerpt when result is non-null");
		assert(parsed.content !== null && parsed.content !== undefined,
			"Readability.parse() returns content when result is non-null");

		return {
			ok: true,
			article: {
				title,
				siteName,
				excerpt: parsed.excerpt,
				wordCount,
				content: parsed.content,
				imageUrl,
			},
		};
	};

	return { parseArticle };
}
