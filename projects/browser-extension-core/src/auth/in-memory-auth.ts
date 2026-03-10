import type { Login, Logout, RefreshTokens, GetAccessToken, WhenLoggedIn } from "./auth.types";

export function initInMemoryAuth(): {
	login: Login;
	logout: Logout;
	refreshTokens: RefreshTokens;
	getAccessToken: GetAccessToken;
	whenLoggedIn: WhenLoggedIn;
} {
	let loggedIn = false;

	const login: Login = async () => {
		loggedIn = true;
		return { ok: true };
	};

	const logout: Logout = async () => {
		loggedIn = false;
	};

	const refreshTokens: RefreshTokens = async () => {
		return { ok: true };
	};

	const getAccessToken: GetAccessToken = async () => {
		return loggedIn ? "in-memory-token" : null;
	};

	const whenLoggedIn: WhenLoggedIn = (fn) => {
		if (!loggedIn) {
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

	return {
		login,
		logout,
		refreshTokens,
		getAccessToken,
		whenLoggedIn,
	};
}
