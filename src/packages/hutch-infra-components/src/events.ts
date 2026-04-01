import { z } from "zod";

export const LINK_SAVED_SOURCE = "hutch.save-link";
export const LINK_SAVED_DETAIL_TYPE = "LinkSaved";
export const LinkSavedDetailSchema = z.object({
	url: z.string(),
	userId: z.string(),
});
export type LinkSavedDetail = z.infer<typeof LinkSavedDetailSchema>;

export const GLOBAL_SUMMARY_GENERATED_SOURCE = "hutch.save-link";
export const GLOBAL_SUMMARY_GENERATED_DETAIL_TYPE = "GlobalSummaryGenerated";
export const GlobalSummaryGeneratedDetailSchema = z.object({
	url: z.string(),
	inputTokens: z.number(),
	outputTokens: z.number(),
});
export type GlobalSummaryGeneratedDetail = z.infer<typeof GlobalSummaryGeneratedDetailSchema>;
