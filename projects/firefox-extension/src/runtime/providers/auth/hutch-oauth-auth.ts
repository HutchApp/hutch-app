import { z } from "zod";
import type { Login, Logout, WhenLoggedIn } from "./auth.types";
import { generateCodeVerifier, generateCodeChallenge } from "./pkce";

const TokenResponseSchema = z.object({
	access_token: z.string(),
	refresh_token: z.string().optional(),
	expires_in: z.number().optional(),
});

const CLIENT_ID = "hutch-firefox-extension";

interface OAuthWindowApi {
	createWindow: (params: {
		url: string;
		type: "popup";
		width: number;
		height: number;
	}) => Promise<{ id?: number }>;
	removeWindow: (windowId: number) => Promise<void>;
	getTabUrl: (tabId: number) => Promise<string | undefined>;
	onTabUpdated: {
		addListener: (
			cb: (
				tabId: number,
				changeInfo: { url?: string; status?: string },
			) => void,
		) => void;
		removeListener: (
			cb: (
				tabId: number,
				changeInfo: { url?: string; status?: string },
			) => void,
		) => void;
	};
	onWindowRemoved: {
		addListener: (cb: (windowId: number) => void) => void;
		removeListener: (cb: (windowId: number) => void) => void;
	};
}

interface HutchOAuthDeps {
	serverUrl: string;
	windowApi: OAuthWindowApi;
	fetchFn: typeof fetch;
}

export function createBrowserWindowApi(): OAuthWindowApi {
	return {
		createWindow: (params) => browser.windows.create(params),
		removeWindow: (windowId) => browser.windows.remove(windowId),
		getTabUrl: async (tabId) => {
			const tab = await browser.tabs.get(tabId);
			return tab.url;
		},
		onTabUpdated: browser.tabs.onUpdated,
		onWindowRemoved: browser.windows.onRemoved,
	};
}

export function initHutchOAuthAuth(deps: HutchOAuthDeps): {
	login: Login;
	logout: Logout;
	whenLoggedIn: WhenLoggedIn;
	getAccessToken: () => Promise<string | null>;
} {
	const { serverUrl, windowApi, fetchFn } = deps;
	const redirectUri = `${serverUrl}/oauth/callback`;

	let accessToken: string | null = null;
	let refreshToken: string | null = null;
	let accessTokenExpiresAt: Date | null = null;

	function isTokenValid(): boolean {
		if (!accessToken || !accessTokenExpiresAt) return false;
		return accessTokenExpiresAt > new Date();
	}

	function hasValidSession(): boolean {
		return isTokenValid() || refreshToken != null;
	}

	function handleCallbackUrl(
		urlString: string,
		params: { state: string },
	): { code: string | null; matched: boolean } {
		if (!urlString.startsWith(redirectUri)) return { code: null, matched: false };

		const url = new URL(urlString);
		if (url.searchParams.get("state") !== params.state) return { code: null, matched: false };

		if (url.searchParams.get("error")) return { code: null, matched: true };

		return { code: url.searchParams.get("code"), matched: true };
	}

	function waitForOAuthCallback(params: {
		windowId: number;
		state: string;
	}): Promise<string | null> {
		return new Promise((resolve) => {
			let settled = false;

			function settle(code: string | null) {
				settled = true;
				windowApi.onTabUpdated.removeListener(onUpdated);
				windowApi.onWindowRemoved.removeListener(onRemoved);
				windowApi.removeWindow(params.windowId).catch(() => {});
				resolve(code);
			}

			const onUpdated = (
				tabId: number,
				changeInfo: { url?: string; status?: string },
			) => {
				if (settled) return;

				if (changeInfo.url) {
					const result = handleCallbackUrl(changeInfo.url, params);
					if (result.matched) {
						settle(result.code);
						return;
					}
				}

				if (changeInfo.status === "complete" && !changeInfo.url) {
					windowApi.getTabUrl(tabId).then((tabUrl) => {
						if (settled || !tabUrl) return;
						const result = handleCallbackUrl(tabUrl, params);
						if (result.matched) {
							settle(result.code);
						}
					}).catch(() => {});
				}
			};

			const onRemoved = (windowId: number) => {
				if (settled || windowId !== params.windowId) return;
				settle(null);
			};

			windowApi.onTabUpdated.addListener(onUpdated);
			windowApi.onWindowRemoved.addListener(onRemoved);
		});
	}

	async function exchangeCodeForTokens(params: {
		code: string;
		codeVerifier: string;
	}): Promise<boolean> {
		const response = await fetchFn(`${serverUrl}/oauth/token`, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "authorization_code",
				code: params.code,
				client_id: CLIENT_ID,
				redirect_uri: redirectUri,
				code_verifier: params.codeVerifier,
			}),
		});

		if (!response.ok) return false;

		const body = TokenResponseSchema.parse(await response.json());
		accessToken = body.access_token;
		refreshToken = body.refresh_token ?? null;
		accessTokenExpiresAt = new Date(
			Date.now() + (body.expires_in ?? 3600) * 1000,
		);

		return true;
	}

	async function refreshAccessToken(): Promise<boolean> {
		if (!refreshToken) return false;

		const response = await fetchFn(`${serverUrl}/oauth/token`, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "refresh_token",
				refresh_token: refreshToken,
				client_id: CLIENT_ID,
			}),
		});

		if (!response.ok) return false;

		const body = TokenResponseSchema.parse(await response.json());
		accessToken = body.access_token;
		refreshToken = body.refresh_token ?? refreshToken;
		accessTokenExpiresAt = new Date(
			Date.now() + (body.expires_in ?? 3600) * 1000,
		);

		return true;
	}

	const login: Login = async () => {
		const codeVerifier = generateCodeVerifier();
		const codeChallenge = await generateCodeChallenge(codeVerifier);
		const state = crypto.randomUUID();

		const authUrl =
			`${serverUrl}/oauth/authorize?` +
			new URLSearchParams({
				client_id: CLIENT_ID,
				redirect_uri: redirectUri,
				response_type: "code",
				code_challenge: codeChallenge,
				code_challenge_method: "S256",
				state,
			}).toString();

		const win = await windowApi.createWindow({
			url: authUrl,
			type: "popup",
			width: 500,
			height: 700,
		});

		if (win.id == null) {
			return { ok: false, reason: "invalid-credentials" };
		}

		const code = await waitForOAuthCallback({
			windowId: win.id,
			state,
		});

		if (!code) {
			return { ok: false, reason: "invalid-credentials" };
		}

		const exchanged = await exchangeCodeForTokens({
			code,
			codeVerifier,
		});

		if (!exchanged) {
			return { ok: false, reason: "invalid-credentials" };
		}

		return { ok: true };
	};

	const logout: Logout = async () => {
		if (refreshToken) {
			await fetchFn(`${serverUrl}/oauth/revoke`, {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({ token: refreshToken }),
			}).catch(() => {});
		}

		accessToken = null;
		refreshToken = null;
		accessTokenExpiresAt = null;
	};

	const whenLoggedIn: WhenLoggedIn = (fn) => {
		if (!hasValidSession()) {
			return { ok: false, reason: "not-logged-in" };
		}
		try {
			const value = fn();
			return { ok: true, value };
		} catch (thrown) {
			const error =
				thrown instanceof Error ? thrown : new Error(String(thrown));
			return { ok: false, reason: "error", error };
		}
	};

	const getAccessToken = async (): Promise<string | null> => {
		if (isTokenValid()) return accessToken;
		if (refreshToken) {
			const refreshed = await refreshAccessToken();
			if (refreshed) return accessToken;
		}
		return null;
	};

	return {
		login,
		logout,
		whenLoggedIn,
		getAccessToken,
	};
}
