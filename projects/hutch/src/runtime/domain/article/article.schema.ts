import { z } from "zod";
import type { Minutes } from "./article.types";

export const SaveArticleInputSchema = z.object({
	url: z.url({ message: "Please enter a valid URL" }),
});

export const MinutesSchema = z.number().transform((n): Minutes => n as Minutes);

export const ArticleStatusSchema = z.enum(["unread", "read"]);
