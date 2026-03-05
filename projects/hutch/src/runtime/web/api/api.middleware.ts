import type { NextFunction, Request, Response } from "express";
import type { AccessToken } from "../../domain/oauth/oauth.types";
import type { UserId } from "../../domain/user/user.types";
import { SIREN_MEDIA_TYPE } from "./siren";

export type ValidateAccessToken = (accessToken: AccessToken) => Promise<UserId | null>;

interface ApiAuthDeps {
	validateAccessToken: ValidateAccessToken;
}

export function initApiAuth(deps: ApiAuthDeps) {
	return async (req: Request, res: Response, next: NextFunction) => {
		const header = req.headers.authorization;
		if (!header?.startsWith("Bearer ")) {
			res
				.status(401)
				.set("WWW-Authenticate", "Bearer")
				.type(SIREN_MEDIA_TYPE)
				.json({
					class: ["error"],
					properties: { code: "missing-token", message: "Bearer token required" },
				});
			return;
		}

		const token = header.slice(7) as AccessToken;
		const userId = await deps.validateAccessToken(token);
		if (!userId) {
			res
				.status(401)
				.set("WWW-Authenticate", 'Bearer error="invalid_token"')
				.type(SIREN_MEDIA_TYPE)
				.json({
					class: ["error"],
					properties: {
						code: "invalid-token",
						message: "Token expired or invalid",
					},
				});
			return;
		}

		req.userId = userId;
		next();
	};
}
