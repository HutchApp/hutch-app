import { z } from "zod";

export const LINK_SAVED = {
	source: "hutch.article" as const,
	detailType: "LinkSaved" as const,
	schema: z.object({
		url: z.string(),
		userId: z.string(),
	}),
};

export const SUMMARY_GENERATED = {
	source: "save-link" as const,
	detailType: "SummaryGenerated" as const,
	schema: z.object({
		url: z.string(),
		summary: z.string().nullable(),
		inputTokens: z.number(),
		outputTokens: z.number(),
	}),
};
