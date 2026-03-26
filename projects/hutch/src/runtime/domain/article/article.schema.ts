import { z } from "zod";
import type { ArticleId, ArticleStatus, Minutes } from "./article.types";

export const SaveArticleInputSchema = z.object({
	url: z.url({ message: "Please enter a valid URL" }),
});

export const ArticleIdSchema = z.string().transform((s): ArticleId => s as ArticleId);

export const MinutesSchema = z.number().transform((n): Minutes => n as Minutes);

export const ArticleStatusSchema = z.enum(["unread", "read", "archived"]).transform((s): ArticleStatus => s === "archived" ? "read" : s);
