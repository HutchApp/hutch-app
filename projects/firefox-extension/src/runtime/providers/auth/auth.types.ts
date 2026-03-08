export type LoginResult = { ok: true };

export type GuardedResult<T> =
	| { ok: true; value: T }
	| { ok: false; reason: "not-logged-in" }
	| { ok: false; reason: "error"; error: Error };

export type Login = () => Promise<LoginResult>;

export type Logout = () => Promise<void>;

export type WhenLoggedIn = <T>(fn: () => T) => GuardedResult<T>;
