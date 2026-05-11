import { z } from "zod";
import type { Minutes } from "./article.types";

const CrawlStageSchema = z.enum([
	"crawl-fetching",
	"crawl-fetched",
	"crawl-parsed",
	"crawl-metadata-written",
	"crawl-content-uploaded",
]);

const SummaryStageSchema = z.enum(["summary-started", "summary-generating"]);

export const CrawlStateSchema = z.discriminatedUnion("status", [
	z.object({ status: z.literal("pending"), stage: CrawlStageSchema.optional() }),
	z.object({ status: z.literal("ready") }),
	z.object({
		status: z.literal("failed"),
		reason: z.string().min(1),
		failedAt: z.string(),
	}),
	z.object({
		status: z.literal("unsupported"),
		reason: z.string().min(1),
		failedAt: z.string(),
	}),
]);

export const SummaryStateSchema = z.discriminatedUnion("status", [
	z.object({
		status: z.literal("pending"),
		stage: SummaryStageSchema.optional(),
	}),
	z.object({
		status: z.literal("ready"),
		summary: z.string().min(1),
		excerpt: z.string().optional(),
		inputTokens: z.number().int().nonnegative(),
		outputTokens: z.number().int().nonnegative(),
	}),
	z.object({
		status: z.literal("failed"),
		reason: z.string().min(1),
	}),
	z.object({
		status: z.literal("skipped"),
		reason: z.string().optional(),
	}),
]);

const ArticleMetadataSchema = z.object({
	title: z.string(),
	siteName: z.string(),
	excerpt: z.string(),
	wordCount: z.number().int().nonnegative(),
	imageUrl: z.string().optional(),
});

export const ArticleAggregateSchema = z.object({
	url: z.string().min(1),
	version: z.number().int().nonnegative(),
	crawl: CrawlStateSchema,
	summary: SummaryStateSchema,
	metadata: ArticleMetadataSchema,
	estimatedReadTime: z.number().transform((n): Minutes => n as Minutes),
	contentFetchedAt: z.string().optional(),
	etag: z.string().optional(),
	lastModified: z.string().optional(),
});
