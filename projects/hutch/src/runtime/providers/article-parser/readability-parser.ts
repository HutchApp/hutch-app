import assert from "node:assert";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import type { CrawlArticle } from "@packages/crawl-article";
import type { ParseArticle, ParseArticleResult } from "./article-parser.types";
import { resolveRelativeUrls } from "./resolve-relative-urls";

export function parseHtml(params: { url: string; html: string; thumbnailUrl?: string }): ParseArticleResult {
	let hostname: string;
	try {
		hostname = new URL(params.url).hostname;
	} catch {
		return { ok: false, reason: "Invalid URL" };
	}

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
				imageUrl: params.thumbnailUrl,
			},
		};
	}

	assert(parsed.textContent != null, "Readability provides textContent for parsed articles");
	assert(parsed.content != null, "Readability provides content for parsed articles");

	return {
		ok: true,
		article: {
			title: parsed.title || `Article from ${hostname}`,
			siteName: parsed.siteName || hostname,
			excerpt: parsed.excerpt || `Content saved from ${hostname}.`,
			wordCount: Array.from(parsed.textContent.matchAll(/\S+/g)).length, /* c8 ignore next -- V8 block coverage phantom: zero-count sub-range at bytecode boundary (bcoe/c8#319, v8.dev/blog/javascript-code-coverage) */
			content: resolveRelativeUrls({ html: parsed.content, baseUrl: params.url }),
			imageUrl: params.thumbnailUrl,
		},
	};
}

export function initReadabilityParser(deps: {
	crawlArticle: CrawlArticle;
}): { parseArticle: ParseArticle } {
	const parseArticle: ParseArticle = async (url) => {
		try {
			new URL(url);
		} catch {
			return { ok: false, reason: "Invalid URL" };
		}

		const result = await deps.crawlArticle({ url });
		if (result.status !== "fetched") {
			return { ok: false, reason: "Could not fetch article" };
		}

		return parseHtml({ url, html: result.html, thumbnailUrl: result.thumbnailUrl });
	};

	return { parseArticle };
}
