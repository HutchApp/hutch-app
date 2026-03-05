import { Router } from "express";
import type { Request, Response } from "express";
import type { ArticleId } from "../../domain/article/article.types";
import { calculateReadTime } from "../../domain/article/estimated-read-time";
import type { ParseArticle } from "../../providers/article-parser/article-parser.types";
import type {
	DeleteArticle,
	FindArticleById,
	FindArticlesByUser,
	SaveArticle,
	UpdateArticleStatus,
} from "../../providers/article-store/article-store.types";
import { toArticleEntity } from "./article-siren";
import { toArticleCollectionEntity } from "./collection-siren";
import { SIREN_MEDIA_TYPE, type SirenEntity } from "./siren";
import {
	articlesQuerySchema,
	saveArticleSchema,
	updateStatusSchema,
} from "./api.schema";

interface ApiRouteDeps {
	findArticlesByUser: FindArticlesByUser;
	findArticleById: FindArticleById;
	saveArticle: SaveArticle;
	parseArticle: ParseArticle;
	deleteArticle: DeleteArticle;
	updateArticleStatus: UpdateArticleStatus;
}

function apiRoot(): SirenEntity {
	return {
		class: ["root"],
		properties: {},
		links: [
			{ rel: ["self"], href: "/api" },
			{ rel: ["articles"], href: "/api/articles" },
			{ rel: ["current-user"], href: "/api/me" },
		],
		actions: [
			{
				name: "save-article",
				href: "/api/articles",
				method: "POST",
				type: "application/json",
				fields: [{ name: "url", type: "url" }],
			},
		],
	};
}

function currentUser(userId: string): SirenEntity {
	return {
		class: ["user"],
		properties: { userId },
		links: [
			{ rel: ["self"], href: "/api/me" },
			{ rel: ["articles"], href: "/api/articles" },
			{ rel: ["root"], href: "/api" },
		],
	};
}

export function initApiRoutes(deps: ApiRouteDeps): Router {
	const router = Router();

	router.get("/", (_req: Request, res: Response) => {
		res.type(SIREN_MEDIA_TYPE).json(apiRoot());
	});

	router.get("/me", (req: Request, res: Response) => {
		res.type(SIREN_MEDIA_TYPE).json(currentUser(req.userId!));
	});

	router.get("/articles", async (req: Request, res: Response) => {
		const parsed = articlesQuerySchema.safeParse(req.query);
		if (!parsed.success) {
			res.status(400).type(SIREN_MEDIA_TYPE).json({
				class: ["error"],
				properties: {
					code: "invalid-query",
					message: "Invalid query parameters",
				},
			});
			return;
		}

		const query = parsed.data;
		const userId = req.userId!;
		const result = await deps.findArticlesByUser({
			userId,
			status: query.status,
			order: query.order,
			page: query.page,
			pageSize: query.pageSize,
		});

		res.type(SIREN_MEDIA_TYPE).json(
			toArticleCollectionEntity(result, {
				status: query.status,
				order: query.order,
				page: query.page,
				pageSize: query.pageSize,
			}),
		);
	});

	router.post("/articles", async (req: Request, res: Response) => {
		const userId = req.userId!;
		const parsed = saveArticleSchema.safeParse(req.body);
		if (!parsed.success) {
			res.status(400).type(SIREN_MEDIA_TYPE).json({
				class: ["error"],
				properties: { code: "invalid-url", message: "A valid URL is required" },
			});
			return;
		}

		const parseResult = await deps.parseArticle(parsed.data.url);
		if (!parseResult.ok) {
			res.status(422).type(SIREN_MEDIA_TYPE).json({
				class: ["error"],
				properties: {
					code: "invalid-url",
					message: "The provided URL could not be parsed as an article",
				},
			});
			return;
		}

		const parsedArticle = parseResult.article;
		const article = await deps.saveArticle({
			userId,
			url: parsed.data.url,
			metadata: {
				title: parsedArticle.title,
				siteName: parsedArticle.siteName,
				excerpt: parsedArticle.excerpt,
				wordCount: parsedArticle.wordCount,
				imageUrl: parsedArticle.imageUrl,
			},
			content: parsedArticle.content,
			estimatedReadTime: calculateReadTime(parsedArticle.wordCount),
		});

		res.status(201).type(SIREN_MEDIA_TYPE).json(toArticleEntity(article));
	});

	router.get("/articles/:id", async (req: Request, res: Response) => {
		const userId = req.userId!;
		const article = await deps.findArticleById(req.params.id as ArticleId);
		if (!article || article.userId !== userId) {
			res.status(404).type(SIREN_MEDIA_TYPE).json({
				class: ["error"],
				properties: { code: "not-found", message: "Article not found" },
			});
			return;
		}

		res.type(SIREN_MEDIA_TYPE).json(toArticleEntity(article));
	});

	router.put("/articles/:id/status", async (req: Request, res: Response) => {
		const userId = req.userId!;
		const parsed = updateStatusSchema.safeParse(req.body);
		if (!parsed.success) {
			res.status(400).type(SIREN_MEDIA_TYPE).json({
				class: ["error"],
				properties: { code: "invalid-status", message: "Invalid status value" },
			});
			return;
		}

		const success = await deps.updateArticleStatus(
			req.params.id as ArticleId,
			userId,
			parsed.data.status,
		);

		if (!success) {
			res.status(404).type(SIREN_MEDIA_TYPE).json({
				class: ["error"],
				properties: { code: "not-found", message: "Article not found" },
			});
			return;
		}

		const article = (await deps.findArticleById(req.params.id as ArticleId))!;
		res.type(SIREN_MEDIA_TYPE).json(toArticleEntity(article));
	});

	router.delete("/articles/:id", async (req: Request, res: Response) => {
		const userId = req.userId!;
		const success = await deps.deleteArticle(req.params.id as ArticleId, userId);

		if (!success) {
			res.status(404).type(SIREN_MEDIA_TYPE).json({
				class: ["error"],
				properties: { code: "not-found", message: "Article not found" },
			});
			return;
		}

		res.status(204).send();
	});

	return router;
}
