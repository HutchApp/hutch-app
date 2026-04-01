import { z } from "zod";

export const GenerateGlobalSummaryCommandSchema = z.object({
	url: z.string(),
});
export type GenerateGlobalSummaryCommand = z.infer<typeof GenerateGlobalSummaryCommandSchema>;

export {
	GLOBAL_SUMMARY_GENERATED_SOURCE,
	GLOBAL_SUMMARY_GENERATED_DETAIL_TYPE,
	GlobalSummaryGeneratedDetailSchema,
	type GlobalSummaryGeneratedDetail,
} from "@packages/hutch-infra-components";
