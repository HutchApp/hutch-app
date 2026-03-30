import assert from "node:assert";
import type { Request, Response, Router } from "express";
import express from "express";
import { SaveArticleInputSchema, ArticleIdSchema, ArticleStatusSchema } from "../../../domain/article/article.schema";
import { calculateReadTime } from "../../../domain/article/estimated-read-time";
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

type SaveArticleFromUrlResult =
	| { ok: true; saved: Awaited<ReturnType<SaveArticle>> }
	| { ok: false; reason: string };

async function saveArticleFromUrl(deps: QueueDependencies, params: {
	userId: UserId;
	url: string;
	freshness: ContentFreshnessResult;
}): Promise<SaveArticleFromUrlResult> {
	const { userId, url, freshness } = params;

	if (freshness.action === "new") {
		const parseResult = await deps.parseArticle(url);
		if (!parseResult.ok) {
			return { ok: false, reason: parseResult.reason };
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
			content: article.content || undefined,
			estimatedReadTime: calculateReadTime(article.wordCount),
		});

		deps.updateArticleFetchMetadata({
			url,
			contentFetchedAt: new Date().toISOString(),
		}).catch((error) => deps.logError("Failed to update fetch metadata", error instanceof Error ? error : undefined));

		if (article.content) {
			await deps.publishLinkSaved({ url, userId });
		}
		await deps.publishLinkSaved({ url, userId });

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
	await deps.publishLinkSaved({ url, userId });

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

		const freshness = await deps.refreshArticleIfStale({ url: parsed.data.url });
		const result = await saveArticleFromUrl(deps, { userId, url: parsed.data.url, freshness });

		if (!result.ok) {
			res.status(422).type(SIREN_MEDIA_TYPE).json(
				sirenError({ code: "parse-failed", message: `Could not parse article: ${result.reason}` }),
			);
			return;
		}

		res.status(201).type(SIREN_MEDIA_TYPE).json(toArticleEntity(result.saved));
	});

	router.post("/save", async (req: Request, res: Response) => {
		assert(req.userId, "userId required - route must be protected by requireAuth");
		const userId = req.userId;
		const parsedBody = SaveArticleInputSchema.safeParse(req.body);

		if (!parsedBody.success) {
			const urlState = parseQueueUrl({});
			const result = await deps.findArticlesByUser({ userId });
			const vm = toQueueViewModel(result, urlState, {
				saveError: "Please enter a valid URL",
			});
			const html = QueuePage(vm, { emailVerified: req.emailVerified }).to("text/html");
			res.status(422).type("html").send(html.body);
			return;
		}

		const freshness = await deps.refreshArticleIfStale({ url: parsedBody.data.url });
		const result = await saveArticleFromUrl(deps, { userId, url: parsedBody.data.url, freshness });

		if (!result.ok) {
			const urlState = parseQueueUrl({});
			const articlesResult = await deps.findArticlesByUser({ userId });
			const vm = toQueueViewModel(articlesResult, urlState, {
				saveError: `Could not parse article: ${result.reason}`,
			});
			const html = QueuePage(vm, { emailVerified: req.emailVerified }).to("text/html");
			res.status(422).type("html").send(html.body);
			return;
		}

		res.redirect(303, "/queue");
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
