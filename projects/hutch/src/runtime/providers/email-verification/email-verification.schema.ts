import { z } from "zod";
import type { VerificationToken } from "./email-verification.types";

export const VerificationTokenSchema = z.string().transform((s): VerificationToken => s as VerificationToken);
