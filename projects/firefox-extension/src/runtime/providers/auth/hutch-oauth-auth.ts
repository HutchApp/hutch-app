import type { Login, Logout, WhenLoggedIn } from "./auth.types";
import { generateCodeVerifier, generateCodeChallenge } from "./pkce";

const CLIENT_ID = "hutch-firefox-extension";

interface OAuthWindowApi {
	createWindow: (params: {
		url: string;
		type: "popup";
		width: number;
		height: number;
	}) => Promise<{ id?: number }>;
	removeWindow: (windowId: number) => Promise<void>;
	onTabUpdated: {
		addListener: (
			cb: (
				tabId: number,
				changeInfo: { url?: string },
			) => void,
		) => void;
		removeListener: (
			cb: (
				tabId: number,
				changeInfo: { url?: string },
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
		onTabUpdated: browser.tabs.onUpdated,
		onWindowRemoved: browser.windows.onRemoved,
	};
}

export function initHutchOAuthAuth(deps: HutchOAuthDeps): {
	login: Login;
	logout: Logout;
	whenLoggedIn: WhenLoggedIn;
	getAccessToken: () => string | null;
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

	function waitForOAuthCallback(params: {
		windowId: number;
		state: string;
	}): Promise<string | null> {
		return new Promise((resolve) => {
			let settled = false;

			const onUpdated = (
				_tabId: number,
				changeInfo: { url?: string },
			) => {
				if (settled || !changeInfo.url?.startsWith(redirectUri)) return;

				const url = new URL(changeInfo.url);
				if (url.searchParams.get("state") !== params.state) return;

				settled = true;
				windowApi.onTabUpdated.removeListener(onUpdated);
				windowApi.onWindowRemoved.removeListener(onRemoved);
				windowApi.removeWindow(params.windowId).catch(() => {});

				if (url.searchParams.get("error")) {
					resolve(null);
					return;
				}

				resolve(url.searchParams.get("code"));
			};

			const onRemoved = (windowId: number) => {
				if (settled || windowId !== params.windowId) return;

				settled = true;
				windowApi.onTabUpdated.removeListener(onUpdated);
				windowApi.onWindowRemoved.removeListener(onRemoved);
				resolve(null);
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

		const body = await response.json();
		accessToken = body.access_token;
		refreshToken = body.refresh_token ?? null;
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
		if (!isTokenValid()) {
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

	const getAccessToken = (): string | null => {
		if (!isTokenValid()) return null;
		return accessToken;
	};

	return {
		login,
		logout,
		whenLoggedIn,
		getAccessToken,
	};
}
