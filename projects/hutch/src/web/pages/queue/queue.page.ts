import type { Request, Response, Router } from "express";
import express from "express";
import type { ArticleStatus } from "../../../domain/article/article.types";
import { SaveArticleInputSchema } from "../../../domain/article/article.schema";
import { calculateReadTime } from "../../../domain/article/estimated-read-time";
import type { ParseArticle } from "../../../providers/article-parser/article-parser.types";
import type {
	DeleteArticle,
	FindArticlesByUser,
	SaveArticle,
	ToggleArticleStar,
	UpdateArticleStatus,
} from "../../../providers/article-store/article-store.types";
import type { UserId } from "../../../domain/user/user.types";
import { Base } from "../../base.component";
import { parseQueueUrl } from "./queue.url";
import { toQueueViewModel } from "./queue.viewmodel";
import { createQueuePageContent } from "./queue.template";

interface QueueDependencies {
	findArticlesByUser: FindArticlesByUser;
	saveArticle: SaveArticle;
	parseArticle: ParseArticle;
	deleteArticle: DeleteArticle;
	updateArticleStatus: UpdateArticleStatus;
	toggleArticleStar: ToggleArticleStar;
}

export function initQueueRoutes(deps: QueueDependencies): Router {
	const router = express.Router();

	router.get("/", async (req: Request, res: Response) => {
		const userId = req.userId as UserId;
		const urlState = parseQueueUrl(req.query as Record<string, unknown>);

		const result = await deps.findArticlesByUser({
			userId,
			status: urlState.status,
			isStarred: urlState.starred,
			order: urlState.order,
			page: urlState.page,
		});

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
			estimatedReadTime: calculateReadTime(article.wordCount),
		});

		res.redirect(303, "/queue");
	});

	router.post("/:id/status", async (req: Request, res: Response) => {
		const userId = req.userId as UserId;
		const articleId = req.params.id as unknown as import("../../../domain/article/article.types").ArticleId;
		const status = req.body.status as ArticleStatus;

		await deps.updateArticleStatus(articleId, userId, status);
		res.redirect(303, req.get("Referer") || "/queue");
	});

	router.post("/:id/star", async (req: Request, res: Response) => {
		const userId = req.userId as UserId;
		const articleId = req.params.id as unknown as import("../../../domain/article/article.types").ArticleId;

		await deps.toggleArticleStar(articleId, userId);
		res.redirect(303, req.get("Referer") || "/queue");
	});

	router.post("/:id/delete", async (req: Request, res: Response) => {
		const userId = req.userId as UserId;
		const articleId = req.params.id as unknown as import("../../../domain/article/article.types").ArticleId;

		await deps.deleteArticle(articleId, userId);
		res.redirect(303, req.get("Referer") || "/queue");
	});

	return router;
}
