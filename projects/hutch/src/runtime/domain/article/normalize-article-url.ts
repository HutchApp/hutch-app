import { createHash } from "node:crypto";
import { ArticleIdSchema } from "./article.schema";
import type { ArticleId } from "./article.types";

export function normalizeArticleUrl(url: string): string {
	const parsed = new URL(url);
	const port = parsed.port ? `:${parsed.port}` : "";
	return `${parsed.hostname}${port}${parsed.pathname}${parsed.search}`;
}

export function routeIdFromUrl(url: string): ArticleId {
	const normalized = normalizeArticleUrl(url);
	const hash = createHash("sha256").update(normalized).digest("hex").slice(0, 32);
	return ArticleIdSchema.parse(hash);
}
