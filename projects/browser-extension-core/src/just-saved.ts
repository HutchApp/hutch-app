import { z } from "zod";

export const JUST_SAVED_KEY = "hutch_just_saved";

const JustSavedSchema = z.object({ url: z.string(), title: z.string() });

export type JustSavedData = z.infer<typeof JustSavedSchema>;

export interface StorageApi {
	get(key: string): Promise<Record<string, unknown>>;
	remove(key: string): Promise<void>;
}

export async function getAndClearJustSaved(storage: StorageApi): Promise<JustSavedData | null> {
	const result = await storage.get(JUST_SAVED_KEY);
	const raw = result[JUST_SAVED_KEY];
	if (!raw) return null;
	const parsed = JustSavedSchema.safeParse(raw);
	if (!parsed.success) return null;
	await storage.remove(JUST_SAVED_KEY);
	return parsed.data;
}
