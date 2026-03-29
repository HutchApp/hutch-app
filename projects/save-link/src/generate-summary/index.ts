import { z } from "zod";

export const GenerateGlobalSummaryCommandSchema = z.object({
	url: z.string(),
});
export type GenerateGlobalSummaryCommand = z.infer<typeof GenerateGlobalSummaryCommandSchema>;

export const GLOBAL_SUMMARY_GENERATED_SOURCE = "hutch.save-link";
export const GLOBAL_SUMMARY_GENERATED_DETAIL_TYPE = "GlobalSummaryGenerated";

export const GlobalSummaryGeneratedDetailSchema = z.object({
	url: z.string(),
	inputTokens: z.number(),
	outputTokens: z.number(),
});
export type GlobalSummaryGeneratedDetail = z.infer<typeof GlobalSummaryGeneratedDetailSchema>;
