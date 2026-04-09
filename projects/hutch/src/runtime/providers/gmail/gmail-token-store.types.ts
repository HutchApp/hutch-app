import type { GmailTokens } from "../../domain/gmail-import/gmail-import.types";
import type { UserId } from "../../domain/user/user.types";

export type SaveGmailTokens = (params: {
	userId: UserId;
	tokens: GmailTokens;
}) => Promise<void>;

export type FindGmailTokens = (userId: UserId) => Promise<GmailTokens | null>;

export type DeleteGmailTokens = (userId: UserId) => Promise<void>;
