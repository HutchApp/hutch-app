import assert from "node:assert";
import { COOKIE_NAME, COOKIE_VALUE, DISMISS_COOKIE_NAME } from "@packages/onboarding-extension-signal";
import type { Request, Response, Router } from "express";
import express from "express";
import { SaveArticleInputSchema, SaveHtmlInputSchema, ArticleStatusSchema, MAX_RAW_HTML_BYTES } from "../../../domain/article/article.schema";
import { ReaderArticleHashIdSchema } from "../../../domain/article/reader-article-hash-id";
import { calculateReadTime } from "../../../domain/article/estimated-read-time";
import type { ContentFreshnessResult, RefreshArticleIfStale } from "../../../providers/article-freshness/check-content-freshness";
import type {
	DeleteArticle,
	FindArticleById,
	FindArticlesByUser,
	SaveArticle,
	UpdateArticleStatus,
} from "../../../providers/article-store/article-store.types";
import type { PublishUpdateFetchTimestamp } from "../../../providers/events/publish-update-fetch-timestamp.types";
import type { ReadArticleContent } from "../../../providers/article-store/read-article-content";
import type {
	FindArticleCrawlStatus,
	MarkCrawlPending,
} from "../../../providers/article-crawl/article-crawl.types";
import type {
	FindGeneratedSummary,
	MarkSummaryPending,
} from "../../../providers/article-summary/article-summary.types";
import { initArticleReader } from "../../shared/article-reader/article-reader";
import type { PollUrlBuilder } from "../../shared/article-reader/article-reader.types";
import type { PublishLinkSaved } from "../../../providers/events/publish-link-saved.types";
import type { PublishSaveLinkRawHtmlCommand } from "../../../providers/events/publish-save-link-raw-html-command.types";
import type { PutPendingHtml } from "../../../providers/pending-html/pending-html.types";
import type { UserId } from "../../../domain/user/user.types";
import { sendComponent } from "../../send-component";
import { wantsSiren } from "../../content-negotiation";
import { SIREN_MEDIA_TYPE, sirenError } from "../../api/siren";
import { toArticleCollectionEntity } from "../../api/collection-siren";
import { toArticleEntity } from "../../api/article-siren";
import { parseQueueUrl, buildQueueUrl } from "./queue.url";
import type { HttpErrorMessageMapping } from "./queue.error";
import { toQueueViewModel } from "./queue.viewmodel";
import { QueuePage } from "./queue.component";
import { ReaderPage } from "../reader/reader.component";
import { ONBOARDING_VERSION } from "../../onboarding/onboarding.steps";

interface QueueDependencies {
	findArticlesByUser: FindArticlesByUser;
	findArticleById: FindArticleById;
	saveArticle: SaveArticle;
	deleteArticle: DeleteArticle;
	updateArticleStatus: UpdateArticleStatus;
	publishLinkSaved: PublishLinkSaved;
	publishSaveLinkRawHtmlCommand: PublishSaveLinkRawHtmlCommand;
	putPendingHtml: PutPendingHtml;
	findGeneratedSummary: FindGeneratedSummary;
	markSummaryPending: MarkSummaryPending;
	findArticleCrawlStatus: FindArticleCrawlStatus;
	markCrawlPending: MarkCrawlPending;
	refreshArticleIfStale: RefreshArticleIfStale;
	publishUpdateFetchTimestamp: PublishUpdateFetchTimestamp;
	readArticleContent: ReadArticleContent;
	httpErrorMessageMapping: HttpErrorMessageMapping;
	logError: (message: string, error?: Error) => void;
}

import type { SavedArticle } from "../../../domain/article/article.types";

async function markUnreadIfRead(deps: Pick<QueueDependencies, "updateArticleStatus">, saved: SavedArticle): Promise<SavedArticle> {
	if (saved.status === "read") {
		await deps.updateArticleStatus(saved.id, saved.userId, "unread");
		return { ...saved, status: "unread", readAt: undefined };
	}
	return saved;
}

type SaveArticleFromUrlResult = { ok: true; saved: Awaited<ReturnType<SaveArticle>> };

async function saveArticleFromUrl(deps: QueueDependencies, params: {
	userId: UserId;
	url: string;
	freshness: ContentFreshnessResult;
}): Promise<SaveArticleFromUrlResult> {
	const { userId, url, freshness } = params;

	if (freshness.action === "new") {
		// Save a hostname-only stub immediately so the queue card has something to
		// render at t=0. The real metadata + content arrive asynchronously via the
		// SaveLinkCommand handler; markCrawlPending is what flips the reader slot
		// into the polling state.
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
		await deps.markCrawlPending({ url });
		await deps.markSummaryPending({ url });
		// Pre-populate the freshness window with the request time so a quick
		// re-save can skip dispatching a duplicate SaveLinkCommand while the
		// worker is mid-crawl. The worker overwrites contentFetchedAt with the
		// actual fetch time after success. Must succeed — awaited (not
		// fire-and-forget) because a missing freshness row would let the next
		// save dispatch a duplicate worker invocation.
		await deps.publishUpdateFetchTimestamp({
			url,
			contentFetchedAt: new Date().toISOString(),
		});
		await deps.publishLinkSaved({ url, userId });
		return { ok: true, saved: await markUnreadIfRead(deps, saved) };
	}

	const saved = await deps.saveArticle({
		userId,
		url,
		metadata: { title: "", siteName: "", excerpt: "", wordCount: 0 },
		estimatedReadTime: calculateReadTime(0),
	});

	if (freshness.action === "refreshed" && freshness.article.article.content) {
		await deps.markSummaryPending({ url });
		await deps.publishLinkSaved({ url, userId });
	}

	return { ok: true, saved: await markUnreadIfRead(deps, saved) };
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
		const totalArticles = (await deps.findArticlesByUser({ userId, page: 1, pageSize: 1 })).total;
		const saveError = deps.httpErrorMessageMapping(req.query);
		const vm = toQueueViewModel(result, urlState, { unreadCount, totalArticles, saveError });
		const extensionInstalled = req.cookies?.[COOKIE_NAME] === COOKIE_VALUE;
		const onboardingDismissed = req.cookies?.[DISMISS_COOKIE_NAME] === ONBOARDING_VERSION;
		const ua = req.headers["user-agent"] ?? "";
		const browser = ua.includes("Firefox/") ? "firefox" as const : ua.includes("Chrome/") ? "chrome" as const : "other" as const;
		sendComponent(
			res,
			QueuePage(vm, { emailVerified: req.emailVerified, saveUrl: filterUrl, extensionInstalled, browser, onboardingDismissed }),
		);
	});

	router.post("/dismiss-onboarding", (_req: Request, res: Response) => {
		res.cookie(DISMISS_COOKIE_NAME, ONBOARDING_VERSION, { path: "/", maxAge: 365 * 24 * 60 * 60 * 1000, sameSite: "lax", httpOnly: true });
		res.redirect(303, "/queue");
	});

	router.post("/", express.json(), async (req: Request, res: Response) => {
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

	router.post("/save-html", express.json({ limit: MAX_RAW_HTML_BYTES }), async (req: Request, res: Response) => {
		if (!wantsSiren(req)) {
			res.status(406).send("Not Acceptable");
			return;
		}

		assert(req.userId, "userId required - route must be protected by requireAuth");
		const userId = req.userId;
		const parsed = SaveHtmlInputSchema.safeParse(req.body);

		if (!parsed.success) {
			res.status(422).type(SIREN_MEDIA_TYPE).json(
				sirenError({ code: "invalid-save-html", message: "Invalid save-html request" }),
			);
			return;
		}

		try {
			const freshness = await deps.refreshArticleIfStale({ url: parsed.data.url });

			await deps.putPendingHtml({ url: parsed.data.url, html: parsed.data.rawHtml });
			await deps.publishSaveLinkRawHtmlCommand({
				url: parsed.data.url,
				userId,
				title: parsed.data.title,
			});

			const result = await saveArticleFromUrl(deps, { userId, url: parsed.data.url, freshness });
			res.status(201).type(SIREN_MEDIA_TYPE).json(toArticleEntity(result.saved));
		} catch (error) {
			deps.logError("Failed to save article from html", error instanceof Error ? error : undefined);
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
			sendComponent(res, QueuePage(vm, { emailVerified: req.emailVerified, statusCode: 422 }));
			return;
		}

		try {
			const freshness = await deps.refreshArticleIfStale({ url: parsedBody.data.url });
			await saveArticleFromUrl(deps, { userId, url: parsedBody.data.url, freshness });
			res.redirect(303, "/queue#latest-saved");
		} catch (error) {
			deps.logError("Failed to save article", error instanceof Error ? error : undefined);
			res.redirect(303, "/queue?error_code=save_failed");
		}
	});

	const reader = initArticleReader(deps);

	function pollUrlBuilderForId(articleId: string): PollUrlBuilder {
		return {
			summary: (n) => `/queue/${articleId}/summary?poll=${n}`,
			reader: (n) => `/queue/${articleId}/reader?poll=${n}`,
		};
	}

	router.get("/:id/read", async (req: Request, res: Response) => {
		assert(req.userId, "userId required - route must be protected by requireAuth");
		const userId = req.userId;
		const parsedId = ReaderArticleHashIdSchema.safeParse(req.params.id);
		const article = parsedId.success
			? await deps.findArticleById(parsedId.data, userId)
			: null;

		if (!article) {
			res.redirect(303, "/queue");
			return;
		}

		if (article.status === "unread") {
			await deps.updateArticleStatus(article.id, userId, "read");
		}

		const audioEnabled = req.query.feature === "audio";
		const state = await reader.resolveReaderState({
			article: {
				url: article.url,
				metadata: article.metadata,
				estimatedReadTime: article.estimatedReadTime,
			},
			pollUrlBuilder: pollUrlBuilderForId(article.id.value),
		});

		sendComponent(
			res,
			ReaderPage({ ...article, content: state.content }, {
				emailVerified: req.emailVerified,
				summary: state.summary,
				summaryPollUrl: state.summaryPollUrl,
				crawl: state.crawl,
				readerPollUrl: state.readerPollUrl,
				audioEnabled,
			}),
		);
	});

	router.get("/:id/summary", async (req: Request, res: Response) => {
		assert(req.userId, "userId required - route must be protected by requireAuth");
		const userId = req.userId;
		const parsedId = ReaderArticleHashIdSchema.safeParse(req.params.id);
		const article = parsedId.success
			? await deps.findArticleById(parsedId.data, userId)
			: null;

		if (!article) {
			res.status(404).type("html").send("");
			return;
		}

		const pollCount = Number(req.query.poll ?? "0");
		const component = await reader.handleSummaryPoll({
			articleUrl: article.url,
			pollCount,
			pollUrlBuilder: pollUrlBuilderForId(article.id.value),
		});
		sendComponent(res, component);
	});

	router.get("/:id/reader", async (req: Request, res: Response) => {
		assert(req.userId, "userId required - route must be protected by requireAuth");
		const userId = req.userId;
		const parsedId = ReaderArticleHashIdSchema.safeParse(req.params.id);
		const article = parsedId.success
			? await deps.findArticleById(parsedId.data, userId)
			: null;

		if (!article) {
			res.status(404).type("html").send("");
			return;
		}

		const pollCount = Number(req.query.poll ?? "0");
		const component = await reader.handleReaderPoll({
			articleUrl: article.url,
			pollCount,
			pollUrlBuilder: pollUrlBuilderForId(article.id.value),
		});
		sendComponent(res, component);
	});

	router.post("/:id/status", async (req: Request, res: Response) => {
		assert(req.userId, "userId required - route must be protected by requireAuth");
		const userId = req.userId;
		const parsedId = ReaderArticleHashIdSchema.safeParse(req.params.id);
		const parsedStatus = ArticleStatusSchema.safeParse(req.body.status);

		if (parsedId.success && parsedStatus.success) {
			await deps.updateArticleStatus(parsedId.data, userId, parsedStatus.data);
		}

		res.redirect(303, buildQueueUrl(parseQueueUrl(req.query)));
	});

	router.post("/:id/delete", async (req: Request, res: Response) => {
		assert(req.userId, "userId required - route must be protected by requireAuth");
		const userId = req.userId;
		const parsedId = ReaderArticleHashIdSchema.safeParse(req.params.id);

		if (parsedId.success) {
			await deps.deleteArticle(parsedId.data, userId);
		}

		res.redirect(303, buildQueueUrl(parseQueueUrl(req.query)));
	});

	return router;
}
