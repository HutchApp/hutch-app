import { Readability } from "@mozilla/readability";
import DOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import { parseHTML } from "linkedom";
import type { ParseArticle } from "./article-parser.types";
import { extractThumbnail } from "./extract-thumbnail";

const purifyWindow = new JSDOM("").window;
const purify = DOMPurify(purifyWindow);

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

		const textContent = parsed.textContent ?? "";
		const wordCount = textContent.split(/\s+/).filter(Boolean).length;

		return {
			ok: true,
			article: {
				title: parsed.title || `Article from ${hostname}`,
				siteName: parsed.siteName || hostname,
				excerpt: parsed.excerpt || `Content saved from ${hostname}.`,
				wordCount,
				content: purify.sanitize(parsed.content ?? ""),
				imageUrl,
			},
		};
	};

	return { parseArticle };
}
