import { z } from "zod";
import type { UserId } from "../../domain/user/user.types";

export const GoogleIdSchema = z.string().brand<"GoogleId">();
export type GoogleId = z.infer<typeof GoogleIdSchema>;

export type FindUserByGoogleId = (googleId: GoogleId) => Promise<UserId | null>;

export type LinkGoogleAccount = (link: {
	googleId: GoogleId;
	userId: UserId;
	email: string;
}) => Promise<void>;

export type UnlinkGoogleAccount = (googleId: GoogleId) => Promise<void>;
