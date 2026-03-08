import type { SavedArticle } from "../../domain/article/article.types";
import type { SirenSubEntity } from "./siren";

export function toArticleSubEntity(article: SavedArticle): SirenSubEntity {
	return {
		class: ["article"],
		rel: ["item"],
		properties: {
			id: article.id,
			url: article.url,
			title: article.metadata.title,
			siteName: article.metadata.siteName,
			excerpt: article.metadata.excerpt,
			wordCount: article.metadata.wordCount,
			imageUrl: article.metadata.imageUrl ?? null,
			estimatedReadTimeMinutes: article.estimatedReadTime as number,
			status: article.status,
			savedAt: article.savedAt.toISOString(),
			readAt: article.readAt?.toISOString() ?? null,
		},
		links: [{ rel: ["self"], href: `/queue/${article.id}` }],
	};
}
