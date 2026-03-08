import type { AccessToken } from "../../domain/oauth/oauth.types";
import type { UserId } from "../../domain/user/user.types";
import type { OAuthModel } from "./oauth-model";

export function createValidateAccessToken(model: OAuthModel) {
	return async (accessToken: AccessToken): Promise<UserId | null> => {
		const token = await model.getAccessToken(accessToken);
		if (!token) return null;
		return token.user.id as UserId;
	};
}
