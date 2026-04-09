import { createHash } from "node:crypto";
import { LinkId } from "@packages/link-id";
import { ArticleIdSchema } from "./article.schema";
import type { ArticleId } from "./article.types";

export const ReaderId = {
	from(url: string): ArticleId {
		const normalized = LinkId.from(url);
		const hash = createHash("sha256").update(normalized).digest("hex").slice(0, 32);
		return ArticleIdSchema.parse(hash);
	},
} as const;
