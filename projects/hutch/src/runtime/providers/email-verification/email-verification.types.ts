import type { UserId } from "../../domain/user/user.types";

export type VerificationToken = string & { readonly __brand: "VerificationToken" };

export type CreateVerificationToken = (userId: UserId) => Promise<VerificationToken>;

export type VerifyEmailToken = (token: VerificationToken) => Promise<
	| { ok: true; userId: UserId }
	| { ok: false; reason: "invalid-token" }
>;
