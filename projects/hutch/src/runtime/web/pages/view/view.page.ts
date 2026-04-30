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
import type { RefreshArticleIfStale } from "../../../providers/article-freshness/check-content-freshness";
import type {
	FindGeneratedSummary,
	MarkSummaryPending,
} from "../../../providers/article-summary/article-summary.types";
import type { PublishSaveAnonymousLink } from "../../../providers/events/publish-save-anonymous-link.types";
import { sendComponent } from "../../send-component";
import { initArticleReader } from "../../shared/article-reader/article-reader";
import type { PollUrlBuilder } from "../../shared/article-reader/article-reader.types";
import { collectUtmParams } from "../../shared/utm";
import { SaveErrorPage } from "../save/save-error.component";
import { ViewLandingPage } from "./view-landing.component";
import { ViewPage, type ViewAction } from "./view.component";

const ViewUrlSchema = z.url();

interface ViewDependencies {
	findArticleByUrl: FindArticleByUrl;
	readArticleContent: ReadArticleContent;
	findGeneratedSummary: FindGeneratedSummary;
	markSummaryPending: MarkSummaryPending;
	findArticleCrawlStatus: FindArticleCrawlStatus;
	markCrawlPending: MarkCrawlPending;
	refreshArticleIfStale: RefreshArticleIfStale;
	saveArticleGlobally: SaveArticleGlobally;
	publishSaveAnonymousLink: PublishSaveAnonymousLink;
}

function renderError(req: Request, res: Response) {
	const redirectUrl = req.userId ? "/queue" : "/";
	const linkLabel = req.userId ? "Go to your queue" : "Go to homepage";
	sendComponent(res, SaveErrorPage({ redirectUrl, linkLabel }));
}

function hostnameFrom(validatedUrl: string): string {
	return new URL(validatedUrl).hostname;
}

function pollUrlBuilderFor(articleUrl: string): PollUrlBuilder {
	return {
		summary: (n) => `/view/summary?url=${encodeURIComponent(articleUrl)}&poll=${n}`,
		reader: (n) => `/view/reader?url=${encodeURIComponent(articleUrl)}&poll=${n}`,
	};
}

function handleViewLanding(req: Request, res: Response) {
	const submittedUrl =
		typeof req.query.url === "string" ? req.query.url : undefined;
	if (submittedUrl === undefined) {
		sendComponent(
			res,
			ViewLandingPage({ isAuthenticated: Boolean(req.userId) }),
		);
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
	const reader = initArticleReader(deps);
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

		const freshness = await deps.refreshArticleIfStale({ url: articleUrl });

		if (freshness.action === "new") {
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

		if (freshness.action === "reprime") {
			await deps.markCrawlPending({ url: articleUrl });
			await deps.markSummaryPending({ url: articleUrl });
			await deps.publishSaveAnonymousLink({ url: articleUrl });
		}

		// Re-read metadata after any first-visit save. In production this returns
		// the stub we just wrote (the worker is async); in tests where the
		// in-memory worker fixture runs synchronously inside the awaited dispatch,
		// this picks up the parsed metadata the fixture wrote.
		const articleSnapshot = await deps.findArticleByUrl(articleUrl);
		assert(articleSnapshot, "article row must exist after saveArticleGlobally");
		const metadata: ArticleMetadata = articleSnapshot.metadata;
		const estimatedReadTime: Minutes = articleSnapshot.estimatedReadTime;

		const pollUrlBuilder = pollUrlBuilderFor(articleUrl);
		const state = await reader.resolveReaderState({
			article: { url: articleUrl, metadata, estimatedReadTime },
			pollUrlBuilder,
		});
		const utmParams = collectUtmParams(req.query);

		const actions: ViewAction[] = [
			{
				name: "Save to My Queue",
				href: `/save?${new URLSearchParams([["url", articleUrl], ...utmParams]).toString()}`,
				variant: "primary",
			},
			{
				name: "Paste another link",
				href: "/view?utm_source=view-article&utm_medium=internal&utm_content=paste-another-link",
				variant: "secondary",
			},
		];

		sendComponent(
			res,
			ViewPage({
				articleUrl,
				metadata,
				estimatedReadTime,
				content: state.content,
				crawl: state.crawl,
				readerPollUrl: state.readerPollUrl,
				summary: state.summary,
				summaryPollUrl: state.summaryPollUrl,
				actions,
			}),
		);
	};
}

function handleViewSummary(deps: ViewDependencies) {
	const reader = initArticleReader(deps);
	return async (req: Request, res: Response): Promise<void> => {
		const parsed = ViewUrlSchema.safeParse(req.query.url);
		if (!parsed.success) {
			res.status(400).type("html").send("");
			return;
		}
		const articleUrl = parsed.data;
		const pollCount = Number(req.query.poll ?? "0");
		const component = await reader.handleSummaryPoll({
			articleUrl,
			pollCount,
			pollUrlBuilder: pollUrlBuilderFor(articleUrl),
		});
		sendComponent(res, component);
	};
}

function handleViewReader(deps: ViewDependencies) {
	const reader = initArticleReader(deps);
	return async (req: Request, res: Response): Promise<void> => {
		const parsed = ViewUrlSchema.safeParse(req.query.url);
		if (!parsed.success) {
			res.status(400).type("html").send("");
			return;
		}
		const articleUrl = parsed.data;
		const pollCount = Number(req.query.poll ?? "0");
		const component = await reader.handleReaderPoll({
			articleUrl,
			pollCount,
			pollUrlBuilder: pollUrlBuilderFor(articleUrl),
		});
		sendComponent(res, component);
	};
}

export function initViewRoutes(deps: ViewDependencies): Router {
	const router = express.Router();

	router.get("/", handleViewLanding);
	router.get("/summary", handleViewSummary(deps));
	router.get("/reader", handleViewReader(deps));
	router.get<string, Record<string, string>>("/*", handleViewArticle(deps));

	return router;
}
