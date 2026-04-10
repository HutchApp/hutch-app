import { z } from "zod";
import type { UserId } from "../../domain/user/user.types";

export type GoogleId = string & { readonly __brand: "GoogleId" };

export type FindUserByGoogleId = (googleId: GoogleId) => Promise<UserId | null>;

export type LinkGoogleAccount = (link: {
	googleId: GoogleId;
	userId: UserId;
	email: string;
}) => Promise<void>;

export const GoogleIdSchema = z.string().transform((s): GoogleId => s as GoogleId);
