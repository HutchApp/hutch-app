import type { AccessToken } from "@packages/domain/oauth";
import type { UserId } from "@packages/domain/user";
import { UserIdSchema } from "@packages/domain/user";
import type { OAuthModel } from "./oauth-model";

export type ValidateAccessToken = (accessToken: AccessToken) => Promise<UserId | null>;

export function createValidateAccessToken(model: OAuthModel): ValidateAccessToken {
	return async (accessToken) => {
		const token = await model.getAccessToken(accessToken);
		if (!token) return null;
		return UserIdSchema.parse(token.user.id);
	};
}
