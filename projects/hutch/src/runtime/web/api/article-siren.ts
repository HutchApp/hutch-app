import type { SavedArticle } from "../../domain/article/article.types";
import type { SirenAction, SirenEntity, SirenSubEntity } from "./siren";

function actionsForStatus(article: SavedArticle): SirenAction[] {
	const base = `/queue/${article.id}`;
	const actions: SirenAction[] = [];

	if (article.status !== "read") {
		actions.push({
			name: "mark-read",
			href: `${base}/status`,
			method: "PUT",
			type: "application/json",
			fields: [{ name: "status", type: "hidden", value: "read" }],
		});
	}
	if (article.status !== "unread") {
		actions.push({
			name: "mark-unread",
			href: `${base}/status`,
			method: "PUT",
			type: "application/json",
			fields: [{ name: "status", type: "hidden", value: "unread" }],
		});
	}
	if (article.status !== "archived") {
		actions.push({
			name: "archive",
			href: `${base}/status`,
			method: "PUT",
			type: "application/json",
			fields: [{ name: "status", type: "hidden", value: "archived" }],
		});
	}
	actions.push({ name: "delete", href: base, method: "DELETE" });

	return actions;
}

export function toArticleEntity(article: SavedArticle): SirenEntity {
	return {
		class: ["article"],
		properties: {
			id: article.id,
			url: article.url,
			title: article.metadata.title,
			siteName: article.metadata.siteName,
			excerpt: article.metadata.excerpt,
			wordCount: article.metadata.wordCount,
			imageUrl: article.metadata.imageUrl ?? null,
			estimatedReadTimeMinutes: article.estimatedReadTime as number,
			content: article.content ?? null,
			status: article.status,
			savedAt: article.savedAt.toISOString(),
			readAt: article.readAt?.toISOString() ?? null,
		},
		links: [
			{ rel: ["self"], href: `/queue/${article.id}` },
			{ rel: ["collection"], href: "/queue" },
			{ rel: ["root"], href: "/queue" },
		],
		actions: actionsForStatus(article),
	};
}

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
