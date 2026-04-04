import assert from "node:assert";
import type { Request, Response, Router } from "express";
import express from "express";
import { SaveArticleInputSchema, ArticleIdSchema, ArticleStatusSchema } from "../../../domain/article/article.schema";
import { calculateReadTime } from "../../../domain/article/estimated-read-time";
import { fitContent } from "../../../domain/article/content-size-guard";
import type { ParseArticle } from "../../../providers/article-parser/article-parser.types";
import type { ContentFreshnessResult, RefreshArticleIfStale } from "../../../providers/article-freshness/check-content-freshness";
import type {
	DeleteArticle,
	FindArticleById,
	FindArticlesByUser,
	SaveArticle,
	UpdateArticleFetchMetadata,
	UpdateArticleStatus,
} from "../../../providers/article-store/article-store.types";
import type { FindCachedSummary } from "../../../providers/article-summary/article-summary.types";
import type { PublishLinkSaved } from "../../../providers/events/publish-link-saved.types";
import type { UserId } from "../../../domain/user/user.types";
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
	publishLinkSaved: PublishLinkSaved;
	findCachedSummary: FindCachedSummary;
	refreshArticleIfStale: RefreshArticleIfStale;
	updateArticleFetchMetadata: UpdateArticleFetchMetadata;
	logError: (message: string, error?: Error) => void;
}

type SaveArticleFromUrlResult = { ok: true; saved: Awaited<ReturnType<SaveArticle>> };

async function saveArticleFromUrl(deps: QueueDependencies, params: {
	userId: UserId;
	url: string;
	freshness: ContentFreshnessResult;
}): Promise<SaveArticleFromUrlResult> {
	const { userId, url, freshness } = params;

	if (freshness.action === "new") {
		const parseResult = await deps.parseArticle(url);
		if (!parseResult.ok) {
			deps.logError(`[FetchArticle] Could not fetch ${url}: ${parseResult.reason}`);
			const hostname = new URL(url).hostname;
			const saved = await deps.saveArticle({
				userId,
				url,
				metadata: {
					title: `Article from ${hostname}`,
					siteName: hostname,
					excerpt: `Saved from ${hostname}.`,
					wordCount: 0,
				},
				estimatedReadTime: calculateReadTime(0),
			});
			return { ok: true, saved };
		}

		const { article } = parseResult;
		const saved = await deps.saveArticle({
			userId,
			url,
			metadata: {
				title: article.title,
				siteName: article.siteName,
				excerpt: article.excerpt,
				wordCount: article.wordCount,
				imageUrl: article.imageUrl,
			},
			content: fitContent(article.content),
			estimatedReadTime: calculateReadTime(article.wordCount),
		});

		deps.updateArticleFetchMetadata({
			url,
			contentFetchedAt: new Date().toISOString(),
		}).catch((error) => deps.logError("Failed to update fetch metadata", error instanceof Error ? error : undefined));

		if (article.content) {
			await deps.publishLinkSaved({ url, userId });
		}

		return { ok: true, saved };
	}

	const saved = await deps.saveArticle({
		userId,
		url,
		metadata: { title: "", siteName: "", excerpt: "", wordCount: 0 },
		estimatedReadTime: calculateReadTime(0),
	});

	if (freshness.action === "refreshed" && freshness.article.article.content) {
		await deps.publishLinkSaved({ url, userId });
	}

	return { ok: true, saved };
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

		const unreadCount = urlState.status === "unread"
			? result.total
			: (await deps.findArticlesByUser({ userId, status: "unread", page: 1, pageSize: 1 })).total;
		const vm = toQueueViewModel(result, urlState, { unreadCount });
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

		try {
			const freshness = await deps.refreshArticleIfStale({ url: parsed.data.url });
			const result = await saveArticleFromUrl(deps, { userId, url: parsed.data.url, freshness });
			res.status(201).type(SIREN_MEDIA_TYPE).json(toArticleEntity(result.saved));
		} catch (error) {
			deps.logError("Failed to save article", error instanceof Error ? error : undefined);
			res.status(500).type(SIREN_MEDIA_TYPE).json(
				sirenError({ code: "save-failed", message: "Could not save article" }),
			);
		}
	});

	router.post("/save", async (req: Request, res: Response) => {
		assert(req.userId, "userId required - route must be protected by requireAuth");
		const userId = req.userId;
		const parsedBody = SaveArticleInputSchema.safeParse(req.body);

		if (!parsedBody.success) {
			const urlState = parseQueueUrl({});
			const result = await deps.findArticlesByUser({ userId });
			const unreadCount = (await deps.findArticlesByUser({ userId, status: "unread", page: 1, pageSize: 1 })).total;
			const vm = toQueueViewModel(result, urlState, {
				saveError: "Please enter a valid URL",
				unreadCount,
			});
			const html = QueuePage(vm, { emailVerified: req.emailVerified }).to("text/html");
			res.status(422).type("html").send(html.body);
			return;
		}

		try {
			const freshness = await deps.refreshArticleIfStale({ url: parsedBody.data.url });
			await saveArticleFromUrl(deps, { userId, url: parsedBody.data.url, freshness });
			res.redirect(303, "/queue");
		} catch (error) {
			deps.logError("Failed to save article", error instanceof Error ? error : undefined);
			res.redirect(303, "/queue");
		}
	});

	router.get("/:id/read", async (req: Request, res: Response) => {
		assert(req.userId, "userId required - route must be protected by requireAuth");
		const userId = req.userId;
		const articleId = ArticleIdSchema.parse(req.params.id);

		const article = await deps.findArticleById(articleId, userId);

		if (!article) {
			res.redirect(303, "/queue");
			return;
		}

		if (article.status === "unread") {
			await deps.updateArticleStatus(articleId, userId, "read");
		}

		const summary = await deps.findCachedSummary(article.url);

		const html = ReaderPage(article, { emailVerified: req.emailVerified, summary }).to("text/html");
		res.status(html.statusCode).type("html").send(html.body);
	});

	router.post("/:id/status", async (req: Request, res: Response) => {
		assert(req.userId, "userId required - route must be protected by requireAuth");
		const userId = req.userId;
		const articleId = ArticleIdSchema.parse(req.params.id);
		const parsed = ArticleStatusSchema.safeParse(req.body.status);

		if (!parsed.success) {
			res.redirect(303, buildQueueUrl(parseQueueUrl(req.query)));
			return;
		}

		await deps.updateArticleStatus(articleId, userId, parsed.data);
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
