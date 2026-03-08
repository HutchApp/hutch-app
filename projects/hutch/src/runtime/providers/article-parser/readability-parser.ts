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
	};

	return { parseArticle };
}
