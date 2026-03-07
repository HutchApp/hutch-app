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
				const clientId = req.body.client_id;
				const redirectUri = req.body.redirect_uri;

				if (!validateRedirectUri(clientId, redirectUri)) {
					res.status(400).json({
						error: "invalid_request",
						error_description: "Invalid redirect_uri",
					});
					return;
				}

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
		} else {
			const accessToken = await deps.model.getAccessToken(token);
			if (accessToken && accessToken.refreshToken) {
				const associatedRefresh = await deps.model.getRefreshToken(accessToken.refreshToken);
				if (associatedRefresh) {
					await deps.model.revokeToken(associatedRefresh);
				}
			}
		}

		res.status(200).json({});
	});

	router.get("/callback", (_req: Request, res: Response) => {
		res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Authorization Complete</title>
	<style>
		body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
		.message { text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
		h1 { color: #333; margin: 0 0 1rem 0; font-size: 1.5rem; }
		p { color: #666; margin: 0; }
	</style>
</head>
<body>
	<div class="message">
		<h1>Authorization Complete</h1>
		<p>You may close this window.</p>
	</div>
</body>
</html>`);
	});

	return router;
}
