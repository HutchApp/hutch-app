import { z } from "zod";

export const GoogleIdSchema = z.string().brand<"GoogleId">();
export type GoogleId = z.infer<typeof GoogleIdSchema>;
