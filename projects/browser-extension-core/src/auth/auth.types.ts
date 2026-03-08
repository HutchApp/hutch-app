export type LoginResult = { ok: true };

export type GuardedResult<T> =
	| { ok: true; value: T }
	| { ok: false; reason: "not-logged-in" }
	| { ok: false; reason: "error"; error: Error };

export type Login = () => Promise<LoginResult>;

export type Logout = () => Promise<void>;

export type WhenLoggedIn = <T>(fn: () => T) => GuardedResult<T>;

export interface Auth {
	login: Login;
	logout: Logout;
	whenLoggedIn: WhenLoggedIn;
}

// refreshToken is stored for future token renewal but not yet used — expired access tokens currently require re-login
export interface OAuthTokens {
	accessToken: string;
	refreshToken: string;
}

export interface TokenStorage {
	getTokens(): Promise<OAuthTokens | null>;
	setTokens(tokens: OAuthTokens): Promise<void>;
	clearTokens(): Promise<void>;
}

export interface OAuthAuthDeps {
	serverUrl: string;
	clientId: string;
	openTab(url: string): Promise<number>;
	waitForRedirect(params: { tabId: number; urlPrefix: string }): Promise<string>;
	closeTab(tabId: number): Promise<void>;
	fetchFn(url: string, init: { method: string; headers: Record<string, string>; body: string }): Promise<{ ok: boolean; status: number; json(): Promise<Record<string, string>> }>;
	tokenStorage: TokenStorage;
}
