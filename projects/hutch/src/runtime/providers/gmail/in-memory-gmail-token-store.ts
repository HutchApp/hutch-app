import type { GmailTokens } from "../../domain/gmail-import/gmail-import.types";
import type { UserId } from "../../domain/user/user.types";
import type { SaveGmailTokens, FindGmailTokens, DeleteGmailTokens } from "./gmail-token-store.types";

export function initInMemoryGmailTokenStore(): {
	saveGmailTokens: SaveGmailTokens;
	findGmailTokens: FindGmailTokens;
	deleteGmailTokens: DeleteGmailTokens;
} {
	const store = new Map<string, GmailTokens>();

	const saveGmailTokens: SaveGmailTokens = async ({ userId, tokens }) => {
		store.set(userId, tokens);
	};

	const findGmailTokens: FindGmailTokens = async (userId: UserId) => {
		return store.get(userId) ?? null;
	};

	const deleteGmailTokens: DeleteGmailTokens = async (userId: UserId) => {
		store.delete(userId);
	};

	return { saveGmailTokens, findGmailTokens, deleteGmailTokens };
}
