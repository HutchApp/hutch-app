import { z } from "zod";
import type { PasswordResetToken } from "./password-reset.types";

export const PasswordResetTokenSchema = z.string().transform((s): PasswordResetToken => s as PasswordResetToken);
