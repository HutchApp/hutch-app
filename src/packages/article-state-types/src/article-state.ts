import { z } from "zod";

export const SummaryStatusSchema = z.enum(["pending", "ready", "failed", "skipped"]);
export type SummaryStatus = z.infer<typeof SummaryStatusSchema>;

export const CrawlStatusSchema = z.enum(["pending", "ready", "failed"]);
export type CrawlStatus = z.infer<typeof CrawlStatusSchema>;
