import { z } from "zod";

export const ImportSessionIdSchema = z
	.string()
	.regex(/^[a-f0-9]{32}$/)
	.brand<"ImportSessionId">();

export type ImportSessionId = z.infer<typeof ImportSessionIdSchema>;

export const ImportToggleSchema = z.object({
	index: z.coerce.number().int().min(0),
	checked: z.enum(["true", "false"]),
});

export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_URLS_PER_IMPORT = 2_000;
export const IMPORT_SESSION_TTL_SECONDS = 24 * 60 * 60;
export const IMPORT_PAGE_SIZE = 50;
export const IMPORT_COMMIT_CONCURRENCY = 25;
