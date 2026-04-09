import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import type { ParseArticle, ParseArticleResult } from "./article-parser.types";
import { extractThumbnail } from "./extract-thumbnail";
import { resolveRelativeUrls } from "./resolve-relative-urls";

export type FetchHtml = (url: string) => Promise<string | undefined>;

export function parseHtml(params: { url: string; html: string }): ParseArticleResult {
	let hostname: string;
	try {
		hostname = new URL(params.url).hostname;
	} catch {
		return { ok: false, reason: "Invalid URL" };
	}

	const imageUrl = extractThumbnail({ html: params.html, baseUrl: params.url });
	const { document } = parseHTML(params.html);
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

	const textContent = parsed.textContent || "";
	const wordCount = textContent.split(/\s+/).filter(Boolean).length; /* c8 ignore next -- c8/Jest worker merge issue */

	const title = parsed.title || `Article from ${hostname}`;
	const siteName = parsed.siteName || hostname;
	const excerpt = parsed.excerpt || `Content saved from ${hostname}.`;
	/* c8 ignore next -- c8/Jest worker merge issue */
	const content = resolveRelativeUrls({ html: parsed.content || "", baseUrl: params.url });

	return {
		ok: true,
		/* c8 ignore next -- c8/Jest worker merge issue */
		article: {
			title,
			siteName,
			excerpt,
			wordCount,
			content,
			imageUrl,
		},
	};
}

export function initReadabilityParser(deps: {
	fetchHtml: FetchHtml;
}): { parseArticle: ParseArticle } {
	const parseArticle: ParseArticle = async (url) => {
		try {
			new URL(url);
		} catch {
			return { ok: false, reason: "Invalid URL" };
		}

		const html = await deps.fetchHtml(url);
		if (!html) {
			return { ok: false, reason: "Could not fetch article" };
		}

		return parseHtml({ url, html });
	};

	return { parseArticle };
}
