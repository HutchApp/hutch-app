import { z } from "zod";
import type { Minutes } from "./article.types";

/** Schemes the save pipeline can crawl. Published on the save-article and save-html
 * Siren actions so clients can gate non-saveable tabs (chrome://, about:, file://...)
 * before attempting a save. */
export const SAVEABLE_URL_SCHEMES = ["http", "https"] as const;

const SaveableUrl = z
	.url({ message: "Please enter a valid URL" })
	.refine(
		(value) => SAVEABLE_URL_SCHEMES.some((s) => value.startsWith(`${s}:`)),
		{ message: "URL scheme is not supported" },
	);

export const SaveArticleInputSchema = z.object({
	url: SaveableUrl,
});

export const MAX_RAW_HTML_BYTES = 10 * 1024 * 1024;

/* Body-parser limit is slightly above MAX_RAW_HTML_BYTES so the rawHtml size
 * check runs in Zod (where `req.body.url` is available for URL-only fallback).
 * Bodies above this ceiling still hit body-parser and the middleware responds
 * with a retry action. Headroom covers JSON key/quote overhead plus escaping. */
export const MAX_RAW_HTML_REQUEST_BYTES = MAX_RAW_HTML_BYTES + 1024 * 1024;

export const SaveHtmlInputSchema = z.object({
	url: SaveableUrl,
	rawHtml: z.string().min(1).max(MAX_RAW_HTML_BYTES),
	title: z.string().max(2048).optional(),
});

export const RAW_HTML_FIELD = "rawHtml" satisfies keyof z.infer<typeof SaveHtmlInputSchema>;

export const MinutesSchema = z.number().transform((n): Minutes => n as Minutes);

export const ArticleStatusSchema = z.enum(["unread", "read"]);
