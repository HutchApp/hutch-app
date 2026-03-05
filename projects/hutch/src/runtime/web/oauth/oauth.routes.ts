import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import ExpressOAuthServer from "@node-oauth/express-oauth-server";
import type { OAuthModel } from "../../providers/oauth/oauth-model";
import { getClient, validateRedirectUri } from "../../providers/oauth/oauth-clients";
import { renderAuthorizePage } from "./oauth.template";

const authorizeQuerySchema = z.object({
	client_id: z.string(),
	redirect_uri: z.string().url(),
	response_type: z.literal("code"),
	code_challenge: z.string().min(43).max(128),
	code_challenge_method: z.literal("S256"),
	state: z.string().optional(),
});

interface OAuthRouteDeps {
	model: OAuthModel;
}

interface OAuthRequest extends Request {
	user?: { id: string };
}

export function initOAuthRoutes(deps: OAuthRouteDeps): Router {
	const router = Router();

	const oauthServer = new ExpressOAuthServer({
		model: deps.model,
		allowExtendedTokenAttributes: true,
		requireClientAuthentication: {
			authorization_code: false,
			refresh_token: false,
		},
	});

	router.get("/authorize", (req: Request, res: Response) => {
		const parsed = authorizeQuerySchema.safeParse(req.query);
		if (!parsed.success) {
			res.status(400).json({
				error: "invalid_request",
				error_description: "Missing or invalid parameters",
			});
			return;
		}

		const { client_id, redirect_uri, state } = parsed.data;

		const client = getClient(client_id);
		if (!client) {
			res.status(400).json({
				error: "invalid_client",
				error_description: "Unknown client_id",
			});
			return;
		}

		if (!validateRedirectUri(client_id, redirect_uri)) {
			res.status(400).json({
				error: "invalid_request",
				error_description: "Invalid redirect_uri",
			});
			return;
		}

		if (!req.userId) {
			const returnUrl = encodeURIComponent(req.originalUrl);
			res.redirect(303, `/login?return=${returnUrl}`);
			return;
		}

		res.type("html").send(
			renderAuthorizePage({
				clientName: client.name,
				clientId: client_id,
				redirectUri: redirect_uri,
				codeChallenge: parsed.data.code_challenge,
				state,
			}),
		);
	});

	router.post(
		"/authorize",
		(req: Request, res: Response, next) => {
			if (!req.userId) {
				res.status(401).json({
					error: "access_denied",
					error_description: "User not authenticated",
				});
				return;
			}

			if (req.body.action === "deny") {
				const redirectUri = req.body.redirect_uri;
				const state = req.body.state;
				const errorUrl = `${redirectUri}?error=access_denied${state ? `&state=${encodeURIComponent(state)}` : ""}`;
				res.redirect(302, errorUrl);
				return;
			}

			(req as OAuthRequest).user = { id: req.userId };

			next();
		},
		oauthServer.authorize({
			authenticateHandler: {
				handle: (req: Request) => {
					return { id: req.userId };
				},
			},
		}),
	);

	router.post("/token", oauthServer.token());

	router.post("/revoke", async (req: Request, res: Response) => {
		const token = req.body.token;
		if (!token) {
			res.status(400).json({
				error: "invalid_request",
				error_description: "token parameter required",
			});
			return;
		}

		const refreshToken = await deps.model.getRefreshToken(token);
		if (refreshToken) {
			await deps.model.revokeToken(refreshToken);
		}

		res.status(200).json({});
	});

	return router;
}
