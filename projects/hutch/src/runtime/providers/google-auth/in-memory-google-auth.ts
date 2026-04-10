import type { UserId } from "../../domain/user/user.types";
import type { GoogleId, FindUserByGoogleId, LinkGoogleAccount } from "./google-auth.schema";

export function initInMemoryGoogleAuth(): {
	findUserByGoogleId: FindUserByGoogleId;
	linkGoogleAccount: LinkGoogleAccount;
} {
	const accounts = new Map<GoogleId, { userId: UserId; email: string }>();

	const findUserByGoogleId: FindUserByGoogleId = async (googleId) => {
		const account = accounts.get(googleId);
		return account?.userId ?? null;
	};

	const linkGoogleAccount: LinkGoogleAccount = async ({ googleId, userId, email }) => {
		accounts.set(googleId, { userId, email });
	};

	return { findUserByGoogleId, linkGoogleAccount };
}
