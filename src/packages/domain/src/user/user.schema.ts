import { z } from "zod";
import type { UserId } from "./user.types";

export const UserIdSchema = z.string().transform((s: string): UserId => s as UserId);
