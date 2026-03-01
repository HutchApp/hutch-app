import type { ParseArticle } from "./article-parser.types";

export function initStaticParser(): { parseArticle: ParseArticle } {
	const parseArticle: ParseArticle = async (url) => {
		let hostname: string;
		try {
			hostname = new URL(url).hostname;
		} catch {
			return { ok: false, reason: "Invalid URL" };
		}

		return {
			ok: true,
			article: {
				title: `Article from ${hostname}`,
				siteName: hostname,
				excerpt: `Content saved from ${hostname}. Full article parsing will be available in a future update.`,
				wordCount: 500,
				content: `<p>Content saved from <a href="${url}">${hostname}</a>. Full article parsing will be available in a future update.</p>`,
			},
		};
	};

	return { parseArticle };
}
