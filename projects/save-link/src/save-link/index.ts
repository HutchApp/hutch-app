import { z } from "zod";

export { LinkId, type LinkId as LinkIdType } from "./link-id";

export const LINK_SAVED_SOURCE = "hutch.save-link";
export const LINK_SAVED_DETAIL_TYPE = "LinkSaved";

export const LinkSavedDetailSchema = z.object({
	url: z.string(),
	userId: z.string(),
});
export type LinkSavedDetail = z.infer<typeof LinkSavedDetailSchema>;
