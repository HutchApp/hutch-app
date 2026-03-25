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

	let textContent = parsed.textContent;
	if (!textContent) textContent = "";
	const wordCount = textContent.split(/\s+/).filter(Boolean).length;

	let title = parsed.title;
	if (!title) title = `Article from ${hostname}`;

	let siteName = parsed.siteName;
	if (!siteName) siteName = hostname;

	let excerpt = parsed.excerpt;
	if (!excerpt) excerpt = `Content saved from ${hostname}.`;

	let content = parsed.content;
	if (!content) content = "";
	content = resolveRelativeUrls({ html: content, baseUrl: params.url });

	return {
		ok: true,
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
