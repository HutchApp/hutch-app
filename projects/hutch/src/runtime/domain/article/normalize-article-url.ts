import { createHash } from "node:crypto";
import { LinkId } from "@packages/link-id";
import { ArticleIdSchema } from "./article.schema";
import type { ArticleId } from "./article.types";

export function normalizeArticleUrl(url: string): string {
	return LinkId.from(url);
}

export function routeIdFromUrl(url: string): ArticleId {
	const normalized = normalizeArticleUrl(url);
	const hash = createHash("sha256").update(normalized).digest("hex").slice(0, 32);
	return ArticleIdSchema.parse(hash);
}
