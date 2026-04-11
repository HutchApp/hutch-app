import type { UserId } from "../../domain/user/user.types";
import type { GoogleId, FindUserByGoogleId, LinkGoogleAccount, UnlinkGoogleAccount } from "./google-auth.schema";

export function initInMemoryGoogleAuth(): {
	findUserByGoogleId: FindUserByGoogleId;
	linkGoogleAccount: LinkGoogleAccount;
	unlinkGoogleAccount: UnlinkGoogleAccount;
} {
	const accounts = new Map<GoogleId, { userId: UserId; email: string }>();

	const findUserByGoogleId: FindUserByGoogleId = async (googleId) => {
		const account = accounts.get(googleId);
		return account?.userId ?? null;
	};

	const linkGoogleAccount: LinkGoogleAccount = async ({ googleId, userId, email }) => {
		accounts.set(googleId, { userId, email });
	};

	const unlinkGoogleAccount: UnlinkGoogleAccount = async (googleId) => {
		accounts.delete(googleId);
	};

	return { findUserByGoogleId, linkGoogleAccount, unlinkGoogleAccount };
}
