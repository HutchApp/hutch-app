import assert from "node:assert";
import type { Request, Response, Router } from "express";
import express from "express";
import type { RunGmailImport } from "../../../domain/gmail-import/gmail-import.types";
import type { ExchangeGmailCode, ListUnreadGmailMessages } from "../../../providers/gmail/gmail-api.types";
import type { FindGmailTokens, SaveGmailTokens, DeleteGmailTokens } from "../../../providers/gmail/gmail-token-store.types";
import type { RefreshGmailAccessToken } from "../../../providers/gmail/gmail-api.types";
import { toGmailImportViewModel } from "./gmail-import.viewmodel";
import { GmailImportPage } from "./gmail-import.component";

const GMAIL_OAUTH_SCOPE = "https://www.googleapis.com/auth/gmail.modify";
const TOKEN_EXPIRY_BUFFER_MS = 60_000;

interface GmailImportDependencies {
	findGmailTokens: FindGmailTokens;
	saveGmailTokens: SaveGmailTokens;
	deleteGmailTokens: DeleteGmailTokens;
	exchangeGmailCode: ExchangeGmailCode;
	refreshGmailAccessToken: RefreshGmailAccessToken;
	listUnreadGmailMessages: ListUnreadGmailMessages;
	runGmailImport: RunGmailImport;
	googleClientId: string;
	appOrigin: string;
	logError: (message: string, error?: Error) => void;
}

function buildGoogleOAuthUrl(params: { clientId: string; redirectUri: string }): string {
	const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
	url.searchParams.set("client_id", params.clientId);
	url.searchParams.set("redirect_uri", params.redirectUri);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("scope", GMAIL_OAUTH_SCOPE);
	url.searchParams.set("access_type", "offline");
	url.searchParams.set("prompt", "consent");
	return url.toString();
}

export function initGmailImportRoutes(deps: GmailImportDependencies): Router {
	const router = express.Router();
	const redirectUri = `${deps.appOrigin}/gmail-import/callback`;

	async function getAccessToken(userId: Parameters<typeof deps.findGmailTokens>[0]) {
		const tokens = await deps.findGmailTokens(userId);
		if (!tokens) return null;

		if (tokens.expiresAt < Date.now() + TOKEN_EXPIRY_BUFFER_MS) {
			const refreshed = await deps.refreshGmailAccessToken({
				refreshToken: tokens.refreshToken,
			});
			await deps.saveGmailTokens({ userId, tokens: refreshed });
			return refreshed.accessToken;
		}

		return tokens.accessToken;
	}

	router.get("/", async (req: Request, res: Response) => {
		assert(req.userId, "userId required - route must be protected by requireAuth");
		const userId = req.userId;

		const tokens = await deps.findGmailTokens(userId);
		const statusMessage = typeof req.query.status === "string" ? req.query.status : undefined;

		let emails: Awaited<ReturnType<typeof deps.listUnreadGmailMessages>> = [];

		if (tokens) {
			try {
				const accessToken = await getAccessToken(userId);
				if (accessToken) {
					emails = await deps.listUnreadGmailMessages({ accessToken });
				}
			} catch (error) {
				deps.logError("Failed to fetch Gmail emails", error instanceof Error ? error : undefined);
			}
		}

		const vm = toGmailImportViewModel({
			isConnected: tokens !== null,
			statusMessage,
			emails,
		});
		const html = GmailImportPage(vm, { emailVerified: req.emailVerified }).to("text/html");
		res.status(html.statusCode).type("html").send(html.body);
	});

	router.get("/connect", (_req: Request, res: Response) => {
		const url = buildGoogleOAuthUrl({
			clientId: deps.googleClientId,
			redirectUri,
		});
		res.redirect(302, url);
	});

	router.get("/callback", async (req: Request, res: Response) => {
		assert(req.userId, "userId required - route must be protected by requireAuth");
		const userId = req.userId;

		const code = req.query.code;
		if (typeof code !== "string") {
			res.redirect(303, "/gmail-import?status=Connection+cancelled");
			return;
		}

		try {
			const tokens = await deps.exchangeGmailCode({ code, redirectUri });
			await deps.saveGmailTokens({ userId, tokens });
			res.redirect(303, "/gmail-import?status=Gmail+connected+successfully");
		} catch (error) {
			deps.logError("Gmail OAuth callback failed", error instanceof Error ? error : undefined);
			res.redirect(303, "/gmail-import?status=Connection+failed.+Please+try+again");
		}
	});

	router.post("/start", async (req: Request, res: Response) => {
		assert(req.userId, "userId required - route must be protected by requireAuth");
		const userId = req.userId;

		const tokens = await deps.findGmailTokens(userId);
		if (!tokens) {
			res.redirect(303, "/gmail-import?status=Please+connect+Gmail+first");
			return;
		}

		const rawIds = req.body.messageIds;
		const messageIds: string[] = Array.isArray(rawIds) ? rawIds : (typeof rawIds === "string" ? [rawIds] : []);

		if (messageIds.length === 0) {
			res.redirect(303, "/gmail-import?status=No+emails+selected");
			return;
		}

		deps.runGmailImport({ userId, messageIds }).catch((error) => {
			deps.logError("Gmail import failed", error instanceof Error ? error : undefined);
		});

		res.redirect(303, `/gmail-import?status=Import+started+for+${messageIds.length}+emails.+Links+will+appear+in+your+queue+shortly`);
	});

	router.post("/disconnect", async (req: Request, res: Response) => {
		assert(req.userId, "userId required - route must be protected by requireAuth");
		const userId = req.userId;

		await deps.deleteGmailTokens(userId);
		res.redirect(303, "/gmail-import?status=Gmail+disconnected");
	});

	return router;
}
