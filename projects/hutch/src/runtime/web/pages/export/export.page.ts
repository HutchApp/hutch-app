import assert from "node:assert";
import type { Request, Response, Router } from "express";
import express from "express";
import type { FindArticlesByUser } from "../../../providers/article-store/article-store.types";
import type { UserId } from "../../../domain/user/user.types";
import type { SavedArticle } from "../../../domain/article/article.types";
import { ExportPage } from "./export.template";

interface ExportDependencies {
	findArticlesByUser: FindArticlesByUser;
}

function toExportArticle(article: SavedArticle) {
	return {
		url: article.url,
		title: article.metadata.title,
		siteName: article.metadata.siteName,
		excerpt: article.metadata.excerpt,
		wordCount: article.metadata.wordCount,
		estimatedReadTimeMinutes: article.estimatedReadTime as number,
		status: article.status,
		savedAt: article.savedAt.toISOString(),
		readAt: article.readAt?.toISOString() ?? null,
	};
}

export async function fetchAllArticles(
	findArticlesByUser: FindArticlesByUser,
	userId: UserId,
	pageSize = 100,
): Promise<SavedArticle[]> {
	const allArticles: SavedArticle[] = [];
	let page = 1;

	while (true) {
		const result = await findArticlesByUser({
			userId,
			page,
			pageSize,
			order: "asc",
		});
		allArticles.push(...result.articles);
		if (allArticles.length >= result.total) break;
		page++;
	}

	return allArticles;
}

export function initExportRoutes(deps: ExportDependencies): Router {
	const router = express.Router();

	router.get("/", (_req: Request, res: Response) => {
		const html = ExportPage().to("text/html");
		res.status(html.statusCode).type("html").send(html.body);
	});

	router.get("/download", async (req: Request, res: Response) => {
		assert(req.userId, "userId required - route must be protected by requireAuth");
		const userId = req.userId as UserId;
		const articles = await fetchAllArticles(
			deps.findArticlesByUser,
			userId,
		);

		const exportData = {
			exportedAt: new Date().toISOString(),
			articleCount: articles.length,
			articles: articles.map(toExportArticle),
		};

		const json = JSON.stringify(exportData, null, 2);
		const timestamp = new Date().toISOString().slice(0, 10);

		res
			.set(
				"Content-Disposition",
				`attachment; filename="hutch-export-${timestamp}.json"`,
			)
			.type("application/json")
			.send(json);
	});

	return router;
}
