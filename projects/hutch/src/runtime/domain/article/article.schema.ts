import { z } from "zod";
import type { Minutes } from "./article.types";

export const SaveArticleInputSchema = z.object({
	url: z.url({ message: "Please enter a valid URL" }),
});

export const MAX_RAW_HTML_BYTES = 10 * 1024 * 1024;

export const SaveHtmlInputSchema = z.object({
	url: z.url({ message: "Please enter a valid URL" }),
	rawHtml: z.string().min(1).max(MAX_RAW_HTML_BYTES),
	title: z.string().max(2048).optional(),
});

export const MinutesSchema = z.number().transform((n): Minutes => n as Minutes);

export const ArticleStatusSchema = z.enum(["unread", "read"]);
