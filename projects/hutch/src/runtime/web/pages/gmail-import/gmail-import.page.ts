import assert from "node:assert";
import type { Request, Response, Router } from "express";
import express from "express";
import type { RunGmailImport } from "../../../domain/gmail-import/gmail-import.types";
import type { ExchangeGmailCode, ListUnreadGmailMessages } from "../../../providers/gmail/gmail-api.types";
import type { FindGmailTokens, SaveGmailTokens, DeleteGmailTokens } from "../../../providers/gmail/gmail-token-store.types";
import type { EnsureValidAccessToken } from "../../../providers/gmail/ensure-valid-access-token";
import { toGmailImportViewModel } from "./gmail-import.viewmodel";
import { GmailImportPage } from "./gmail-import.component";

const GMAIL_OAUTH_SCOPE = "https://www.googleapis.com/auth/gmail.modify";

const KNOWN_STATUS_MESSAGES = new Set([
	"Gmail connected successfully",
	"Connection cancelled",
	"Connection failed. Please try again",
	"Please connect Gmail first",
	"No emails selected",
	"Gmail disconnected",
	"Import failed. Please try again",
]);

function validateStatusMessage(raw: unknown): string | undefined {
	if (typeof raw !== "string") return undefined;
	if (KNOWN_STATUS_MESSAGES.has(raw)) return raw;
	if (/^Imported \d+ links from \d+ emails\. \d+ skipped$/.test(raw)) return raw;
	return undefined;
}

interface GmailImportDependencies {
	findGmailTokens: FindGmailTokens;
	saveGmailTokens: SaveGmailTokens;
	deleteGmailTokens: DeleteGmailTokens;
	exchangeGmailCode: ExchangeGmailCode;
	ensureValidAccessToken: EnsureValidAccessToken;
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

	router.get("/", async (req: Request, res: Response) => {
		assert(req.userId, "userId required - route must be protected by requireAuth");
		const userId = req.userId;

		const tokens = await deps.findGmailTokens(userId);
		const statusMessage = validateStatusMessage(req.query.status);

		let emails: Awaited<ReturnType<typeof deps.listUnreadGmailMessages>> = [];

		if (tokens) {
			try {
				const accessToken = await deps.ensureValidAccessToken(userId);
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

		try {
			const result = await deps.runGmailImport({ userId, messageIds });
			res.redirect(303, `/gmail-import?status=Imported+${result.importedCount}+links+from+${messageIds.length}+emails.+${result.skippedCount}+skipped`);
		} catch (error) {
			deps.logError("Gmail import failed", error instanceof Error ? error : undefined);
			res.redirect(303, "/gmail-import?status=Import+failed.+Please+try+again");
		}
	});

	router.post("/disconnect", async (req: Request, res: Response) => {
		assert(req.userId, "userId required - route must be protected by requireAuth");
		const userId = req.userId;

		await deps.deleteGmailTokens(userId);
		res.redirect(303, "/gmail-import?status=Gmail+disconnected");
	});

	return router;
}
