import assert from "node:assert";
import type { Request, Response, Router } from "express";
import express from "express";
import { z } from "zod";
import type {
	ArticleMetadata,
	Minutes,
} from "../../../domain/article/article.types";
import { calculateReadTime } from "../../../domain/article/estimated-read-time";
import type {
	FindArticleByUrl,
	SaveArticleGlobally,
} from "../../../providers/article-store/article-store.types";
import type { ReadArticleContent } from "../../../providers/article-store/read-article-content";
import type {
	FindArticleCrawlStatus,
	MarkCrawlPending,
} from "../../../providers/article-crawl/article-crawl.types";
import type {
	FindGeneratedSummary,
	MarkSummaryPending,
} from "../../../providers/article-summary/article-summary.types";
import type { PublishSaveAnonymousLink } from "../../../providers/events/publish-save-anonymous-link.types";
import { renderReaderSlot } from "../../shared/article-body/reader-slot/reader-slot.component";
import { renderSummarySlot } from "../../shared/article-body/summary-slot/summary-slot.component";
import { collectUtmParams } from "../../shared/utm";
import { SaveErrorPage } from "../save/save-error.component";
import { ViewLandingPage } from "./view-landing.component";
import { ViewPage, type ViewAction } from "./view.component";
import { initViewArticleRateLimit } from "./view.rate-limit";

const ViewUrlSchema = z.url();

interface ViewDependencies {
	findArticleByUrl: FindArticleByUrl;
	readArticleContent: ReadArticleContent;
	findGeneratedSummary: FindGeneratedSummary;
	markSummaryPending: MarkSummaryPending;
	findArticleCrawlStatus: FindArticleCrawlStatus;
	markCrawlPending: MarkCrawlPending;
	saveArticleGlobally: SaveArticleGlobally;
	publishSaveAnonymousLink: PublishSaveAnonymousLink;
}

function renderError(req: Request, res: Response) {
	const redirectUrl = req.userId ? "/queue" : "/";
	const linkLabel = req.userId ? "Go to your queue" : "Go to homepage";
	const html = SaveErrorPage({ redirectUrl, linkLabel }).to("text/html");
	res.status(html.statusCode).type("html").send(html.body);
}

function hostnameFrom(validatedUrl: string): string {
	return new URL(validatedUrl).hostname;
}

function handleViewLanding(req: Request, res: Response) {
	const submittedUrl =
		typeof req.query.url === "string" ? req.query.url : undefined;
	if (submittedUrl === undefined) {
		const html = ViewLandingPage({
			isAuthenticated: Boolean(req.userId),
		}).to("text/html");
		res.status(html.statusCode).type("html").send(html.body);
		return;
	}
	const parsed = ViewUrlSchema.safeParse(submittedUrl);
	if (!parsed.success) {
		renderError(req, res);
		return;
	}
	res.redirect(302, `/view/${encodeURIComponent(parsed.data)}`);
}

function handleViewArticle(deps: ViewDependencies) {
	return async (
		req: Request<Record<string, string>>,
		res: Response,
	): Promise<void> => {
		const rawPath = req.params[0];
		// API Gateway v2 HTTP API decodes %2F to / before invoking Lambda, so
		// /view/https%3A%2F%2Fexample.com arrives here as /view/https://example.com.
		// Restore the scheme's second slash if any proxy collapsed it (https:/ → https://).
		const normalizedUrl = rawPath.replace(/^(https?):\/(?!\/)/i, "$1://");
		const parsedUrl = ViewUrlSchema.safeParse(normalizedUrl);
		if (!parsedUrl.success) {
			renderError(req, res);
			return;
		}
		const articleUrl = parsedUrl.data;

		const cached = await deps.findArticleByUrl(articleUrl);

		if (!cached) {
			// First visit for this URL — save a hostname-only stub immediately and
			// dispatch SaveAnonymousLinkCommand so the worker crawls, parses, and
			// writes content + real metadata asynchronously. The reader slot below
			// shows a pending state until polling picks up the completed crawl.
			const hostname = hostnameFrom(articleUrl);
			await deps.saveArticleGlobally({
				url: articleUrl,
				metadata: {
					title: hostname,
					siteName: hostname,
					excerpt: "",
					wordCount: 0,
				},
				estimatedReadTime: calculateReadTime(0),
			});
			await deps.markCrawlPending({ url: articleUrl });
			await deps.markSummaryPending({ url: articleUrl });
			await deps.publishSaveAnonymousLink({ url: articleUrl });
		}

		// Re-read metadata + content after the dispatch above. In production this
		// returns the same stub the web layer just wrote (the worker is async); in
		// tests where the in-memory worker fixture runs synchronously inside the
		// awaited dispatch, this picks up the parsed metadata + content + ready
		// crawl status that the fixture wrote.
		const articleSnapshot = await deps.findArticleByUrl(articleUrl);
		assert(articleSnapshot, "article row must exist after saveArticleGlobally");
		const metadata: ArticleMetadata = articleSnapshot.metadata;
		const estimatedReadTime: Minutes = articleSnapshot.estimatedReadTime;
		const content = await deps.readArticleContent(articleUrl);

		const crawl = await deps.findArticleCrawlStatus(articleUrl);
		const summary = await deps.findGeneratedSummary(articleUrl);
		const utmParams = collectUtmParams(req.query);
		const summaryStatus = summary?.status ?? "pending";
		const summaryPollUrl = summaryStatus === "pending"
			? `/view/summary?url=${encodeURIComponent(articleUrl)}&poll=1`
			: undefined;
		const readerPollUrl = crawl?.status === "pending"
			? `/view/reader?url=${encodeURIComponent(articleUrl)}&poll=1`
			: undefined;

		const actions: ViewAction[] = [
			{
				name: "Save to My Queue",
				href: `/save?${new URLSearchParams([["url", articleUrl], ...utmParams]).toString()}`,
				variant: "primary",
			},
			{
				name: "Paste another link",
				href: "/view",
				variant: "secondary",
			},
		];

		const html = ViewPage({
			articleUrl,
			metadata,
			estimatedReadTime,
			content,
			crawl,
			readerPollUrl,
			summary,
			summaryPollUrl,
			actions,
		}).to("text/html");
		res.status(html.statusCode).type("html").send(html.body);
	};
}

function handleViewSummary(deps: ViewDependencies) {
	return async (req: Request, res: Response): Promise<void> => {
		const parsed = ViewUrlSchema.safeParse(req.query.url);
		if (!parsed.success) {
			res.status(400).type("html").send("");
			return;
		}
		const articleUrl = parsed.data;
		const summary = await deps.findGeneratedSummary(articleUrl);
		const status = summary?.status ?? "pending";
		const pollCount = Number(req.query.poll ?? "0");
		const MAX_POLLS = 40;
		const summaryPollUrl = status === "pending" && pollCount < MAX_POLLS
			? `/view/summary?url=${encodeURIComponent(articleUrl)}&poll=${pollCount + 1}`
			: undefined;

		const html = renderSummarySlot({ summary, summaryPollUrl, summaryOpen: true });
		res.type("html").send(html);
	};
}

function handleViewReader(deps: ViewDependencies) {
	return async (req: Request, res: Response): Promise<void> => {
		const parsed = ViewUrlSchema.safeParse(req.query.url);
		if (!parsed.success) {
			res.status(400).type("html").send("");
			return;
		}
		const articleUrl = parsed.data;
		const crawl = await deps.findArticleCrawlStatus(articleUrl);
		const content = await deps.readArticleContent(articleUrl);
		const pollCount = Number(req.query.poll ?? "0");
		const MAX_POLLS = 40;
		const readerPollUrl = crawl?.status === "pending" && pollCount < MAX_POLLS
			? `/view/reader?url=${encodeURIComponent(articleUrl)}&poll=${pollCount + 1}`
			: undefined;

		const html = renderReaderSlot({ crawl, content, url: articleUrl, readerPollUrl });
		res.type("html").send(html);
	};
}

export function initViewRoutes(deps: ViewDependencies): Router {
	const router = express.Router();

	const rateLimit = initViewArticleRateLimit({ windowMs: 10_000, limit: 20 });

	router.get("/", handleViewLanding);
	router.get("/summary", rateLimit, handleViewSummary(deps));
	router.get("/reader", rateLimit, handleViewReader(deps));
	router.get<string, Record<string, string>>("/*", rateLimit, handleViewArticle(deps));

	return router;
}
