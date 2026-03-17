import type { AccessToken } from "../../domain/oauth/oauth.types";
import type { UserId } from "../../domain/user/user.types";
import type { OAuthModel } from "./oauth-model";
import { createValidateAccessToken } from "./validate-access-token";

describe("createValidateAccessToken", () => {
	it("returns the userId when the token is valid", async () => {
		const expectedUserId = "user-42" as UserId;
		const model = {
			getAccessToken: async () => ({
				accessToken: "valid-token",
				client: { id: "c", grants: [] },
				user: { id: expectedUserId },
			}),
		} as unknown as OAuthModel;

		const validate = createValidateAccessToken(model);
		const result = await validate("valid-token" as AccessToken);

		expect(result).toBe(expectedUserId);
	});

	it("returns null when the token is not found", async () => {
		const model = {
			getAccessToken: async () => null,
		} as unknown as OAuthModel;

		const validate = createValidateAccessToken(model);
		const result = await validate("missing-token" as AccessToken);

		expect(result).toBeNull();
	});
});
