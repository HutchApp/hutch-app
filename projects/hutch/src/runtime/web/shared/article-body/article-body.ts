import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Minutes } from "../../../domain/article/article.types";
import { requireEnv } from "../../../require-env";
import { render } from "../../render";

const STATIC_BASE_URL = requireEnv("STATIC_BASE_URL");

const ARTICLE_BODY_TEMPLATE = readFileSync(
	join(__dirname, "article-body.template.html"),
	"utf-8",
);
const ARTICLE_BODY_NO_CONTENT_TEMPLATE = readFileSync(
	join(__dirname, "article-body-no-content.template.html"),
	"utf-8",
);

export interface ArticleBodyInput {
	title: string;
	siteName: string;
	estimatedReadTime: Minutes;
	url: string;
	content?: string;
	summary?: string | null;
	summaryOpen?: boolean;
	audioEnabled?: boolean;
	backLink?: { href: string; label: string };
}

export function renderArticleBody(input: ArticleBodyInput): string {
	if (!input.content) {
		return render(ARTICLE_BODY_NO_CONTENT_TEMPLATE, { url: input.url });
	}

	const hasSummary = typeof input.summary === "string" && input.summary.length > 0;
	return render(ARTICLE_BODY_TEMPLATE, {
		title: input.title,
		siteName: input.siteName,
		estimatedReadTime: input.estimatedReadTime,
		url: input.url,
		content: input.content,
		summary: hasSummary ? input.summary : undefined,
		summaryOpen: input.summaryOpen === true,
		audioEnabled: input.audioEnabled,
		backLink: input.backLink,
		staticBaseUrl: STATIC_BASE_URL,
	});
}
