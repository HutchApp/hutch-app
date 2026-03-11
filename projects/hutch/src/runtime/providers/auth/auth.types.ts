import type { UserId } from "../../domain/user/user.types";

export type CreateUserResult =
	| { ok: true; userId: UserId }
	| { ok: false; reason: "email-already-exists" };

export type VerifyCredentialsResult =
	| { ok: true; userId: UserId }
	| { ok: false; reason: "invalid-credentials" };

export type CreateUser = (credentials: {
	email: string;
	password: string;
}) => Promise<CreateUserResult>;

export type VerifyCredentials = (credentials: {
	email: string;
	password: string;
}) => Promise<VerifyCredentialsResult>;

export type CreateSession = (userId: UserId) => Promise<string>;

export type GetSessionUserId = (sessionId: string) => Promise<UserId | null>;

export type DestroySession = (sessionId: string) => Promise<void>;

export type CountUsers = () => Promise<number>;
