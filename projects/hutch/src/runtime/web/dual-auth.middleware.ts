import type { Request, Response, NextFunction } from "express";
import type { AccessToken } from "../domain/oauth/oauth.types";
import type { UserId } from "../domain/user/user.types";
import { wantsSiren, SIREN_MEDIA_TYPE } from "./content-negotiation";

export type ValidateAccessToken = (accessToken: AccessToken) => Promise<UserId | null>;

interface DualAuthDeps {
	validateAccessToken: ValidateAccessToken;
}

export function initDualAuth(deps: DualAuthDeps) {
	return async (req: Request, res: Response, next: NextFunction) => {
		if (wantsSiren(req)) {
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
			return;
		}

		if (!req.userId) {
			res.redirect(303, "/login");
			return;
		}
		next();
	};
}
