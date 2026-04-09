import { createHash } from "node:crypto";
import { ArticleUniqueId } from "@packages/article-unique-id";
import { ArticleIdSchema } from "./article.schema";
import type { ArticleId } from "./article.types";

export const ReaderId = {
	from(url: string): ArticleId {
		const articleUniqueId = ArticleUniqueId.parse(url);
		const hash = createHash("sha256").update(articleUniqueId.value).digest("hex").slice(0, 32);
		return ArticleIdSchema.parse(hash);
	},
} as const;
