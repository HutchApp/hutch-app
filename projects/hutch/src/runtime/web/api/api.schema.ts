import { z } from "zod";

export const saveArticleSchema = z.object({
	url: z.string().url(),
});

export const updateStatusSchema = z.object({
	status: z.enum(["unread", "read", "archived"]),
});

export const articlesQuerySchema = z.object({
	status: z.enum(["unread", "read", "archived"]).optional(),
	order: z.enum(["asc", "desc"]).optional().default("desc"),
	page: z.coerce.number().int().positive().optional().default(1),
	pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});
