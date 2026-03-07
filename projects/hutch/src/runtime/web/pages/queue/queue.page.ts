import assert from "node:assert";
import type { Request, Response, Router } from "express";
import express from "express";
import type { ArticleId } from "../../../domain/article/article.types";
import { SaveArticleInputSchema, UpdateStatusSchema } from "../../../domain/article/article.schema";
import { calculateReadTime } from "../../../domain/article/estimated-read-time";
import type { ParseArticle } from "../../../providers/article-parser/article-parser.types";
import type {
	DeleteArticle,
	FindArticleById,
	FindArticlesByUser,
	SaveArticle,
	UpdateArticleStatus,
} from "../../../providers/article-store/article-store.types";
import type { UserId } from "../../../domain/user/user.types";
import { Base } from "../../base.component";
import { wantsSiren, SIREN_MEDIA_TYPE } from "../../content-negotiation";
import { toArticleEntity } from "../../api/article-siren";
import { toArticleCollectionEntity } from "../../api/collection-siren";
import { parseQueueUrl } from "./queue.url";
import { toQueueViewModel } from "./queue.viewmodel";
import { createQueuePageContent } from "./queue.template";
import { createReaderPageContent } from "../reader/reader.template";

interface QueueDependencies {
	findArticlesByUser: FindArticlesByUser;
	findArticleById: FindArticleById;
	saveArticle: SaveArticle;
	parseArticle: ParseArticle;
	deleteArticle: DeleteArticle;
	updateArticleStatus: UpdateArticleStatus;
}

export function initQueueRoutes(deps: QueueDependencies): Router {
	const router = express.Router();

	router.get("/", async (req: Request, res: Response) => {
		const userId = req.userId as UserId;
		const urlState = parseQueueUrl(req.query as Record<string, unknown>);

		const result = await deps.findArticlesByUser({
			userId,
			status: urlState.status,
			order: urlState.order,
			page: urlState.page,
		});

		if (wantsSiren(req)) {
			res.type(SIREN_MEDIA_TYPE).json(
				toArticleCollectionEntity(result, {
					status: urlState.status,
					order: urlState.order,
					page: urlState.page,
					pageSize: result.pageSize,
				}),
			);
			return;
		}

		const vm = toQueueViewModel(result, urlState);
		const pageContent = createQueuePageContent(vm);
		const component = Base(pageContent);
		const html = component.to("text/html");
		res.status(html.statusCode).type("html").send(html.body);
	});

	router.post("/save", async (req: Request, res: Response) => {
		const userId = req.userId as UserId;
		const parsed = SaveArticleInputSchema.safeParse(req.body);

		if (!parsed.success) {
			if (wantsSiren(req)) {
				res.status(400).type(SIREN_MEDIA_TYPE).json({
					class: ["error"],
					properties: { code: "invalid-url", message: "A valid URL is required" },
				});
				return;
			}
			const urlState = parseQueueUrl({});
			const result = await deps.findArticlesByUser({ userId });
			const vm = toQueueViewModel(result, urlState, {
				saveError: "Please enter a valid URL",
			});
			const pageContent = createQueuePageContent(vm);
			const component = Base(pageContent);
			const html = component.to("text/html");
			res.status(422).type("html").send(html.body);
			return;
		}

		const parseResult = await deps.parseArticle(parsed.data.url);

		if (!parseResult.ok) {
			if (wantsSiren(req)) {
				res.status(422).type(SIREN_MEDIA_TYPE).json({
					class: ["error"],
					properties: {
						code: "invalid-url",
						message: "The provided URL could not be parsed as an article",
					},
				});
				return;
			}
			const urlState = parseQueueUrl({});
			const result = await deps.findArticlesByUser({ userId });
			const vm = toQueueViewModel(result, urlState, {
				saveError: `Could not parse article: ${parseResult.reason}`,
			});
			const pageContent = createQueuePageContent(vm);
			const component = Base(pageContent);
			const html = component.to("text/html");
			res.status(422).type("html").send(html.body);
			return;
		}

		const { article: parsedArticle } = parseResult;
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
			content: parsedArticle.content || undefined,
			estimatedReadTime: calculateReadTime(parsedArticle.wordCount),
		});

		if (wantsSiren(req)) {
			res.status(201).type(SIREN_MEDIA_TYPE).json(toArticleEntity(article));
			return;
		}

		res.redirect(303, "/queue");
	});

	router.post("/", async (req: Request, res: Response) => {
		const userId = req.userId as UserId;
		const parsed = SaveArticleInputSchema.safeParse(req.body);

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

		const { article: parsedArticle } = parseResult;
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
			content: parsedArticle.content || undefined,
			estimatedReadTime: calculateReadTime(parsedArticle.wordCount),
		});

		res.status(201).type(SIREN_MEDIA_TYPE).json(toArticleEntity(article));
	});

	router.get("/:id/read", async (req: Request, res: Response) => {
		const userId = req.userId as UserId;
		const articleId = req.params.id as ArticleId;

		const article = await deps.findArticleById(articleId);

		if (!article || article.userId !== userId) {
			if (wantsSiren(req)) {
				res.status(404).type(SIREN_MEDIA_TYPE).json({
					class: ["error"],
					properties: { code: "not-found", message: "Article not found" },
				});
				return;
			}
			res.redirect(303, "/queue");
			return;
		}

		if (wantsSiren(req)) {
			res.type(SIREN_MEDIA_TYPE).json(toArticleEntity(article));
			return;
		}

		const pageContent = createReaderPageContent(article);
		const component = Base(pageContent);
		const html = component.to("text/html");
		res.status(html.statusCode).type("html").send(html.body);
	});

	router.get("/:id", async (req: Request, res: Response) => {
		const userId = req.userId as UserId;
		const articleId = req.params.id as ArticleId;

		const article = await deps.findArticleById(articleId);

		if (!article || article.userId !== userId) {
			res.status(404).type(SIREN_MEDIA_TYPE).json({
				class: ["error"],
				properties: { code: "not-found", message: "Article not found" },
			});
			return;
		}

		res.type(SIREN_MEDIA_TYPE).json(toArticleEntity(article));
	});

	router.post("/:id/status", async (req: Request, res: Response) => {
		const userId = req.userId as UserId;
		const articleId = req.params.id as ArticleId;
		const parsed = UpdateStatusSchema.safeParse(req.body);

		if (!parsed.success) {
			if (wantsSiren(req)) {
				res.status(400).type(SIREN_MEDIA_TYPE).json({
					class: ["error"],
					properties: { code: "invalid-status", message: "Invalid status value" },
				});
				return;
			}
			res.redirect(303, req.get("Referer") || "/queue");
			return;
		}

		const success = await deps.updateArticleStatus(articleId, userId, parsed.data.status);

		if (wantsSiren(req)) {
			if (!success) {
				res.status(404).type(SIREN_MEDIA_TYPE).json({
					class: ["error"],
					properties: { code: "not-found", message: "Article not found" },
				});
				return;
			}
			const article = await deps.findArticleById(articleId);
			assert(article, "Article must exist after successful status update");
			res.type(SIREN_MEDIA_TYPE).json(toArticleEntity(article));
			return;
		}

		res.redirect(303, req.get("Referer") || "/queue");
	});

	router.put("/:id/status", async (req: Request, res: Response) => {
		const userId = req.userId as UserId;
		const articleId = req.params.id as ArticleId;
		const parsed = UpdateStatusSchema.safeParse(req.body);

		if (!parsed.success) {
			res.status(400).type(SIREN_MEDIA_TYPE).json({
				class: ["error"],
				properties: { code: "invalid-status", message: "Invalid status value" },
			});
			return;
		}

		const success = await deps.updateArticleStatus(articleId, userId, parsed.data.status);

		if (!success) {
			res.status(404).type(SIREN_MEDIA_TYPE).json({
				class: ["error"],
				properties: { code: "not-found", message: "Article not found" },
			});
			return;
		}

		const article = await deps.findArticleById(articleId);
		assert(article, "Article must exist after successful status update");
		res.type(SIREN_MEDIA_TYPE).json(toArticleEntity(article));
	});

	router.post("/:id/delete", async (req: Request, res: Response) => {
		const userId = req.userId as UserId;
		const articleId = req.params.id as ArticleId;

		const success = await deps.deleteArticle(articleId, userId);

		if (wantsSiren(req)) {
			if (!success) {
				res.status(404).type(SIREN_MEDIA_TYPE).json({
					class: ["error"],
					properties: { code: "not-found", message: "Article not found" },
				});
				return;
			}
			res.status(204).send();
			return;
		}

		res.redirect(303, req.get("Referer") || "/queue");
	});

	router.delete("/:id", async (req: Request, res: Response) => {
		const userId = req.userId as UserId;
		const articleId = req.params.id as ArticleId;

		const success = await deps.deleteArticle(articleId, userId);

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
