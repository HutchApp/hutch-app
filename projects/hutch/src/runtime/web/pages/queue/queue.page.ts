import assert from "node:assert";
import type { Request, Response, Router } from "express";
import express from "express";
import { SaveArticleInputSchema, ArticleIdSchema, ArticleStatusSchema } from "../../../domain/article/article.schema";
import { calculateReadTime } from "../../../domain/article/estimated-read-time";
import type { ParseArticle } from "../../../providers/article-parser/article-parser.types";
import type {
	DeleteArticle,
	FindArticleById,
	FindArticlesByUser,
	SaveArticle,
	UpdateArticleStatus,
} from "../../../providers/article-store/article-store.types";
import { wantsSiren } from "../../content-negotiation";
import { SIREN_MEDIA_TYPE, sirenError } from "../../api/siren";
import { toArticleCollectionEntity } from "../../api/collection-siren";
import { toArticleEntity } from "../../api/article-siren";
import { parseQueueUrl, buildQueueUrl } from "./queue.url";
import { toQueueViewModel } from "./queue.viewmodel";
import { QueuePage } from "./queue.component";
import { ReaderPage } from "../reader/reader.component";

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
		assert(req.userId, "userId required - route must be protected by requireAuth");
		const userId = req.userId;
		const urlState = parseQueueUrl(req.query);
		const filterUrl = typeof req.query.url === "string" ? req.query.url : undefined;

		const result = await deps.findArticlesByUser({
			userId,
			status: urlState.status,
			order: urlState.order,
			page: urlState.page,
		});

		if (wantsSiren(req)) {
			const filteredArticles = filterUrl
				? result.articles.filter(a => a.url === filterUrl)
				: result.articles;
			const filtered = filterUrl
				? { ...result, articles: filteredArticles, total: filteredArticles.length }
				: result;

			res.type(SIREN_MEDIA_TYPE).json(
				toArticleCollectionEntity(filtered, {
					status: urlState.status,
					order: urlState.order,
					page: urlState.page,
					pageSize: result.pageSize,
					url: filterUrl,
				}),
			);
			return;
		}

		const vm = toQueueViewModel(result, urlState);
		const html = QueuePage(vm, { emailVerified: req.emailVerified }).to("text/html");
		res.status(html.statusCode).type("html").send(html.body);
	});

	router.post("/", async (req: Request, res: Response) => {
		if (!wantsSiren(req)) {
			res.status(406).send("Not Acceptable");
			return;
		}

		assert(req.userId, "userId required - route must be protected by requireAuth");
		const userId = req.userId;
		const parsed = SaveArticleInputSchema.safeParse(req.body);

		if (!parsed.success) {
			res.status(422).type(SIREN_MEDIA_TYPE).json(
				sirenError({ code: "invalid-url", message: "Please enter a valid URL" }),
			);
			return;
		}

		const parseResult = await deps.parseArticle(parsed.data.url);

		if (!parseResult.ok) {
			res.status(422).type(SIREN_MEDIA_TYPE).json(
				sirenError({ code: "parse-failed", message: `Could not parse article: ${parseResult.reason}` }),
			);
			return;
		}

		const { article } = parseResult;
		const saved = await deps.saveArticle({
			userId,
			url: parsed.data.url,
			metadata: {
				title: article.title,
				siteName: article.siteName,
				excerpt: article.excerpt,
				wordCount: article.wordCount,
				imageUrl: article.imageUrl,
			},
			content: article.content || undefined,
			estimatedReadTime: calculateReadTime(article.wordCount),
		});

		res.status(201).type(SIREN_MEDIA_TYPE).json(toArticleEntity(saved));
	});

	router.post("/save", async (req: Request, res: Response) => {
		assert(req.userId, "userId required - route must be protected by requireAuth");
		const userId = req.userId;
		const parsed = SaveArticleInputSchema.safeParse(req.body);

		if (!parsed.success) {
			const urlState = parseQueueUrl({});
			const result = await deps.findArticlesByUser({ userId });
			const vm = toQueueViewModel(result, urlState, {
				saveError: "Please enter a valid URL",
			});
			const html = QueuePage(vm, { emailVerified: req.emailVerified }).to("text/html");
			res.status(422).type("html").send(html.body);
			return;
		}

		const parseResult = await deps.parseArticle(parsed.data.url);

		if (!parseResult.ok) {
			const urlState = parseQueueUrl({});
			const result = await deps.findArticlesByUser({ userId });
			const vm = toQueueViewModel(result, urlState, {
				saveError: `Could not parse article: ${parseResult.reason}`,
			});
			const html = QueuePage(vm, { emailVerified: req.emailVerified }).to("text/html");
			res.status(422).type("html").send(html.body);
			return;
		}

		const { article } = parseResult;
		await deps.saveArticle({
			userId,
			url: parsed.data.url,
			metadata: {
				title: article.title,
				siteName: article.siteName,
				excerpt: article.excerpt,
				wordCount: article.wordCount,
				imageUrl: article.imageUrl,
			},
			content: article.content || undefined,
			estimatedReadTime: calculateReadTime(article.wordCount),
		});

		res.redirect(303, "/queue");
	});

	router.get("/:id/read", async (req: Request, res: Response) => {
		assert(req.userId, "userId required - route must be protected by requireAuth");
		const userId = req.userId;
		const articleId = ArticleIdSchema.parse(req.params.id);

		const article = await deps.findArticleById(articleId);

		if (!article || article.userId !== userId) {
			res.redirect(303, "/queue");
			return;
		}

		const html = ReaderPage(article, { emailVerified: req.emailVerified }).to("text/html");
		res.status(html.statusCode).type("html").send(html.body);
	});

	router.post("/:id/status", async (req: Request, res: Response) => {
		assert(req.userId, "userId required - route must be protected by requireAuth");
		const userId = req.userId;
		const articleId = ArticleIdSchema.parse(req.params.id);
		const status = ArticleStatusSchema.parse(req.body.status);

		await deps.updateArticleStatus(articleId, userId, status);
		const returnState = parseQueueUrl(req.query);
		res.redirect(303, buildQueueUrl(returnState));
	});

	router.post("/:id/delete", async (req: Request, res: Response) => {
		assert(req.userId, "userId required - route must be protected by requireAuth");
		const userId = req.userId;
		const articleId = ArticleIdSchema.parse(req.params.id);

		await deps.deleteArticle(articleId, userId);

		if (wantsSiren(req)) {
			res.status(204).send();
			return;
		}

		const returnState = parseQueueUrl(req.query);
		res.redirect(303, buildQueueUrl(returnState));
	});

	return router;
}
