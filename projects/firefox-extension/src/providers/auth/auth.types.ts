export type LoginResult =
	| { ok: true }
	| { ok: false; reason: "invalid-credentials" };

export type GuardedResult<T> =
	| { ok: true; value: T }
	| { ok: false; reason: "not-logged-in" }
	| { ok: false; reason: "error"; error: Error };

export type Login = (credentials: {
	email: string;
	password: string;
}) => Promise<LoginResult>;

export type Logout = () => Promise<void>;

export type WhenLoggedIn = <T>(fn: () => T) => GuardedResult<T>;
