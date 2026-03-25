import type { ParseArticle } from "./article-parser.types";
import { extractThumbnail } from "./extract-thumbnail";
import type { FetchHtml } from "./readability-parser";

export function initStaticParser(deps: {
	fetchHtml: FetchHtml;
}): { parseArticle: ParseArticle } {
	const parseArticle: ParseArticle = async (url) => {
		let hostname: string;
		try {
			hostname = new URL(url).hostname;
		} catch {
			return { ok: false, reason: "Invalid URL" };
		}

		let imageUrl: string | undefined;
		const html = await deps.fetchHtml(url);
		if (html) {
			imageUrl = extractThumbnail({ html, baseUrl: url });
		}

		return {
			ok: true,
			article: {
				title: `Article from ${hostname}`,
				siteName: hostname,
				excerpt: `Content saved from ${hostname}. Full article parsing will be available in a future update.`,
				wordCount: 500,
				content: `<p>Content saved from <a href="${url}">${hostname}</a>. Full article parsing will be available in a future update.</p>`,
				imageUrl,
			},
		};
	};

	return { parseArticle };
}
