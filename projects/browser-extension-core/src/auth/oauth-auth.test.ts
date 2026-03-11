import { initOAuthAuth } from "./oauth-auth";
import type { OAuthAuthDeps, OAuthTokens, TokenStorage } from "./auth.types";

function createMockTokenStorage(): TokenStorage & { stored: OAuthTokens | null } {
	const store: { stored: OAuthTokens | null } = { stored: null };
	return {
		get stored() {
			return store.stored;
		},
		async getTokens() {
			return store.stored;
		},
		async setTokens(tokens: OAuthTokens) {
			store.stored = tokens;
		},
		async clearTokens() {
			store.stored = null;
		},
	};
}

function createMockDeps(overrides?: Partial<OAuthAuthDeps>) {
	let capturedState = "";
	let capturedAuthorizeUrl = "";
	let capturedTokenUrl = "";
	let capturedTokenOptions: { method: string; headers: Record<string, string>; body: string } | undefined;
	let capturedCloseTabId: number | undefined;

	const openTab = async (url: string) => {
		capturedAuthorizeUrl = url;
		const parsed = new URL(url);
		capturedState = parsed.searchParams.get("state") ?? "";
		return 42;
	};

	const waitForRedirect = async () => {
		return `http://localhost:3000/oauth/callback?code=test-code&state=${capturedState}`;
	};

	const closeTab = async (tabId: number) => {
		capturedCloseTabId = tabId;
	};

	const fetchFn = async (url: string, init: { method: string; headers: Record<string, string>; body: string }) => {
		capturedTokenUrl = url;
		capturedTokenOptions = init;
		return {
			ok: true as boolean,
			status: 200,
			json: async () => ({
				access_token: "access-123",
				refresh_token: "refresh-456",
			}),
		};
	};

	return {
		serverUrl: "http://localhost:3000",
		clientId: "test-client",
		openTab,
		waitForRedirect,
		closeTab,
		fetchFn,
		tokenStorage: createMockTokenStorage(),
		logger: { warn: () => {} },
		captured: {
			get authorizeUrl() { return capturedAuthorizeUrl; },
			get tokenUrl() { return capturedTokenUrl; },
			get tokenOptions() { return capturedTokenOptions; },
			get closeTabId() { return capturedCloseTabId; },
		},
		...overrides,
	};
}

describe("initOAuthAuth", () => {
	describe("whenLoggedIn before login", () => {
		it("should return not-logged-in", async () => {
			const deps = createMockDeps();
			const auth = await initOAuthAuth(deps);

			const result = auth.whenLoggedIn(() => "value");
			expect(result).toEqual({ ok: false, reason: "not-logged-in" });
		});
	});

	describe("login", () => {
		it("should open a tab with the authorize URL", async () => {
			const deps = createMockDeps();
			const auth = await initOAuthAuth(deps);

			await auth.login();

			const url = deps.captured.authorizeUrl;
			expect(url).toContain("http://localhost:3000/oauth/authorize");
			expect(url).toContain("client_id=test-client");
			expect(url).toContain("response_type=code");
			expect(url).toContain("code_challenge_method=S256");
			expect(url).toContain("code_challenge=");
			expect(url).toContain("state=");
		});

		it("should wait for redirect to callback URL", async () => {
			let capturedRedirectParams: { tabId: number; urlPrefix: string } | undefined;
			const deps = createMockDeps({
				waitForRedirect: async (params) => {
					capturedRedirectParams = params;
					return `http://localhost:3000/oauth/callback?code=test-code&state=${new URL(deps.captured.authorizeUrl).searchParams.get("state")}`;
				},
			});
			const auth = await initOAuthAuth(deps);

			await auth.login();

			expect(capturedRedirectParams).toEqual({
				tabId: 42,
				urlPrefix: "http://localhost:3000/oauth/callback",
			});
		});

		it("should close the tab after redirect", async () => {
			const deps = createMockDeps();
			const auth = await initOAuthAuth(deps);

			await auth.login();

			expect(deps.captured.closeTabId).toBe(42);
		});

		it("should exchange code for tokens", async () => {
			const deps = createMockDeps();
			const auth = await initOAuthAuth(deps);

			await auth.login();

			expect(deps.captured.tokenUrl).toBe("http://localhost:3000/oauth/token");
			expect(deps.captured.tokenOptions?.method).toBe("POST");
			expect(deps.captured.tokenOptions?.body).toContain("grant_type=authorization_code");
			expect(deps.captured.tokenOptions?.body).toContain("code=test-code");
			expect(deps.captured.tokenOptions?.body).toContain("client_id=test-client");
			expect(deps.captured.tokenOptions?.body).toContain("code_verifier=");
		});

		it("should store tokens after successful exchange", async () => {
			const tokenStorage = createMockTokenStorage();
			const deps = createMockDeps({ tokenStorage });
			const auth = await initOAuthAuth(deps);

			await auth.login();

			expect(tokenStorage.stored).toEqual({
				accessToken: "access-123",
				refreshToken: "refresh-456",
			});
		});

		it("should be logged in after login", async () => {
			const deps = createMockDeps();
			const auth = await initOAuthAuth(deps);

			await auth.login();

			const result = auth.whenLoggedIn(() => "hello");
			expect(result).toEqual({ ok: true, value: "hello" });
		});

		it("should throw when OAuth returns an error", async () => {
			const deps = createMockDeps({
				waitForRedirect: async () =>
					"http://localhost:3000/oauth/callback?error=access_denied",
			});
			const auth = await initOAuthAuth(deps);

			await expect(auth.login()).rejects.toThrow("OAuth authorization denied");
		});

		it("should throw when callback has no code", async () => {
			const deps = createMockDeps({
				waitForRedirect: async () =>
					"http://localhost:3000/oauth/callback?state=anything",
			});
			const auth = await initOAuthAuth(deps);

			await expect(auth.login()).rejects.toThrow("No authorization code");
		});

		it("should throw on state mismatch", async () => {
			const deps = createMockDeps({
				waitForRedirect: async () =>
					"http://localhost:3000/oauth/callback?code=test-code&state=wrong-state",
			});
			const auth = await initOAuthAuth(deps);

			await expect(auth.login()).rejects.toThrow("state mismatch");
		});

		it("should throw when token exchange fails", async () => {
			const deps = createMockDeps({
				fetchFn: async () => ({ ok: false as boolean, status: 400, json: async () => ({}) }),
			});
			const auth = await initOAuthAuth(deps);

			await expect(auth.login()).rejects.toThrow("Token exchange failed");
		});

		it("should throw when token response has invalid shape", async () => {
			const deps = createMockDeps({
				fetchFn: async () => ({
					ok: true as boolean,
					status: 200,
					json: async () => ({ unexpected: "shape" }),
				}),
			});
			const auth = await initOAuthAuth(deps);

			await expect(auth.login()).rejects.toThrow();
		});
	});

	describe("logout", () => {
		it("should revoke tokens on the server", async () => {
			const tokenStorage = createMockTokenStorage();
			let revokeUrl = "";
			let revokeOptions: { method: string; headers: Record<string, string>; body: string } | undefined;
			const deps = createMockDeps({
				tokenStorage,
				fetchFn: async (url, init) => {
					revokeUrl = url;
					revokeOptions = init;
					return { ok: true, status: 200, json: async () => ({ access_token: "access-123", refresh_token: "refresh-456" }) };
				},
			});
			const auth = await initOAuthAuth(deps);

			await auth.login();

			revokeUrl = "";
			revokeOptions = undefined;

			await auth.logout();

			expect(revokeUrl).toBe("http://localhost:3000/oauth/revoke");
			expect(revokeOptions).toEqual(expect.objectContaining({
				method: "POST",
				body: JSON.stringify({ token: "refresh-456" }),
			}));
		});

		it("should clear stored tokens", async () => {
			const tokenStorage = createMockTokenStorage();
			const deps = createMockDeps({ tokenStorage });
			const auth = await initOAuthAuth(deps);

			await auth.login();
			expect(tokenStorage.stored).not.toBeNull();

			await auth.logout();
			expect(tokenStorage.stored).toBeNull();
		});

		it("should be logged out after logout", async () => {
			const deps = createMockDeps();
			const auth = await initOAuthAuth(deps);

			await auth.login();
			await auth.logout();

			const result = auth.whenLoggedIn(() => "value");
			expect(result).toEqual({ ok: false, reason: "not-logged-in" });
		});
	});

	describe("whenLoggedIn callback throws", () => {
		it("should catch the error and return it", async () => {
			const deps = createMockDeps();
			const auth = await initOAuthAuth(deps);
			await auth.login();
			const thrownError = new Error("something broke");

			const result = auth.whenLoggedIn(() => {
				throw thrownError;
			});

			expect(result.ok).toBe(false);
			if (!result.ok && result.reason === "error") {
				expect(result.error).toBe(thrownError);
			}
		});
	});

	describe("session restoration", () => {
		it("should restore logged-in state from stored tokens", async () => {
			const tokenStorage = createMockTokenStorage();
			await tokenStorage.setTokens({
				accessToken: "stored-access",
				refreshToken: "stored-refresh",
			});

			const deps = createMockDeps({ tokenStorage });
			const auth = await initOAuthAuth(deps);

			const result = auth.whenLoggedIn(() => "restored");
			expect(result).toEqual({ ok: true, value: "restored" });
		});
	});
});
