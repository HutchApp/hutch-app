import { z } from "zod";
import type { UserId } from "./user.types";

export const UserIdSchema = z.string().transform((s): UserId => s as UserId);
