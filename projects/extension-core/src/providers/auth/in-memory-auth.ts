import type { Login, Logout, WhenLoggedIn } from "./auth.types";

export function initInMemoryAuth(): {
	login: Login;
	logout: Logout;
	whenLoggedIn: WhenLoggedIn;
} {
	let loggedIn = false;

	const login: Login = async ({ email }) => {
		if (!email) {
			return { ok: false, reason: "invalid-credentials" };
		}
		loggedIn = true;
		return { ok: true };
	};

	const logout: Logout = async () => {
		loggedIn = false;
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
		whenLoggedIn,
	};
}
