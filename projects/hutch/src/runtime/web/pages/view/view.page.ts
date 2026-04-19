import type { Request, Response, Router } from "express";
import express from "express";
import { z } from "zod";
import type {
	ArticleMetadata,
	Minutes,
} from "../../../domain/article/article.types";
import { calculateReadTime } from "../../../domain/article/estimated-read-time";
import type { ParseArticle } from "../../../providers/article-parser/article-parser.types";
import type {
	FindArticleByUrl,
	SaveArticleGlobally,
} from "../../../providers/article-store/article-store.types";
import type { ReadArticleContent } from "../../../providers/article-store/read-article-content";
import type { FindCachedSummary } from "../../../providers/article-summary/article-summary.types";
import type { PublishSaveAnonymousLink } from "../../../providers/events/publish-save-anonymous-link.types";
import { collectUtmParams } from "../../shared/utm";
import { SaveErrorPage } from "../save/save-error.component";
import { ViewLandingPage } from "./view-landing.component";
import { ViewPage, type ViewAction } from "./view.component";
import { initViewArticleRateLimit } from "./view.rate-limit";

const ViewUrlSchema = z.url();

interface ViewDependencies {
	findArticleByUrl: FindArticleByUrl;
	readArticleContent: ReadArticleContent;
	parseArticle: ParseArticle;
	findCachedSummary: FindCachedSummary;
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
		const cachedContent = cached
			? await deps.readArticleContent(articleUrl)
			: undefined;

		let metadata: ArticleMetadata;
		let estimatedReadTime: Minutes;
		let content: string | undefined;

		if (cached && cachedContent) {
			metadata = cached.metadata;
			estimatedReadTime = cached.estimatedReadTime;
			content = cachedContent;
		} else {
			const parseResult = await deps.parseArticle(articleUrl);
			if (!parseResult.ok) {
				const hostname = hostnameFrom(articleUrl);
				metadata = cached?.metadata ?? {
					title: hostname,
					siteName: hostname,
					excerpt: "Preview unavailable.",
					wordCount: 0,
				};
				estimatedReadTime = cached?.estimatedReadTime ?? calculateReadTime(0);
				content = undefined;
			} else {
				const parsed = parseResult.article;
				metadata = {
					title: parsed.title,
					siteName: parsed.siteName,
					excerpt: parsed.excerpt,
					wordCount: parsed.wordCount,
					...(parsed.imageUrl ? { imageUrl: parsed.imageUrl } : {}),
				};
				estimatedReadTime = calculateReadTime(parsed.wordCount);
				content = parsed.content;

				// Prime on first visit: an existing articles row means a prior
				// visit already dispatched SaveAnonymousLinkCommand for this URL,
				// so skip to avoid re-triggering the crawl / S3 write / summary
				// pipeline. /view is a viewing action, not a user save, so the
				// SaveAnonymousLinkCommand path is used regardless of auth.
				if (!cached) {
					await deps.saveArticleGlobally({
						url: articleUrl,
						metadata,
						estimatedReadTime,
					});
					await deps.publishSaveAnonymousLink({ url: articleUrl });
				}
			}
		}

		const summary = await deps.findCachedSummary(articleUrl);
		const utmParams = collectUtmParams(req.query);

		const actions: ViewAction[] = [
			{
				name: "Save to My Queue",
				href: `/save?${new URLSearchParams([["url", articleUrl], ...utmParams]).toString()}`,
			},
			{
				name: "View another article",
				href: "/view",
			},
		];

		const html = ViewPage({
			articleUrl,
			metadata,
			estimatedReadTime,
			content,
			summary,
			actions,
		}).to("text/html");
		res.status(html.statusCode).type("html").send(html.body);
	};
}

export function initViewRoutes(deps: ViewDependencies): Router {
	const router = express.Router();

	const rateLimit = initViewArticleRateLimit({ windowMs: 10_000, limit: 20 });

	router.get("/", handleViewLanding);
	router.get<string, Record<string, string>>("/*", rateLimit, handleViewArticle(deps));

	return router;
}
