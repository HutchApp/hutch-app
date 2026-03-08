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

function createMockDeps(overrides?: Partial<OAuthAuthDeps>): OAuthAuthDeps {
	let capturedState = "";

	const openTab = jest.fn().mockImplementation((url: string) => {
		const parsed = new URL(url);
		capturedState = parsed.searchParams.get("state") ?? "";
		return Promise.resolve(42);
	});

	const waitForRedirect = jest.fn().mockImplementation(() => {
		return Promise.resolve(
			`http://localhost:3000/oauth/callback?code=test-code&state=${capturedState}`,
		);
	});

	return {
		serverUrl: "http://localhost:3000",
		clientId: "test-client",
		openTab,
		waitForRedirect,
		closeTab: jest.fn().mockResolvedValue(undefined),
		fetchFn: jest.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				access_token: "access-123",
				refresh_token: "refresh-456",
			}),
		}),
		tokenStorage: createMockTokenStorage(),
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

			expect(deps.openTab).toHaveBeenCalledTimes(1);
			const url = (deps.openTab as jest.Mock).mock.calls[0][0] as string;
			expect(url).toContain("http://localhost:3000/oauth/authorize");
			expect(url).toContain("client_id=test-client");
			expect(url).toContain("response_type=code");
			expect(url).toContain("code_challenge_method=S256");
			expect(url).toContain("code_challenge=");
			expect(url).toContain("state=");
		});

		it("should wait for redirect to callback URL", async () => {
			const deps = createMockDeps();
			const auth = await initOAuthAuth(deps);

			await auth.login();

			expect(deps.waitForRedirect).toHaveBeenCalledWith({
				tabId: 42,
				urlPrefix: "http://localhost:3000/oauth/callback",
			});
		});

		it("should close the tab after redirect", async () => {
			const deps = createMockDeps();
			const auth = await initOAuthAuth(deps);

			await auth.login();

			expect(deps.closeTab).toHaveBeenCalledWith(42);
		});

		it("should exchange code for tokens", async () => {
			const deps = createMockDeps();
			const auth = await initOAuthAuth(deps);

			await auth.login();

			expect(deps.fetchFn).toHaveBeenCalledTimes(1);
			const [url, options] = (deps.fetchFn as jest.Mock).mock.calls[0];
			expect(url).toBe("http://localhost:3000/oauth/token");
			expect(options.method).toBe("POST");
			expect(options.body).toContain("grant_type=authorization_code");
			expect(options.body).toContain("code=test-code");
			expect(options.body).toContain("client_id=test-client");
			expect(options.body).toContain("code_verifier=");
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
				waitForRedirect: jest.fn().mockResolvedValue(
					"http://localhost:3000/oauth/callback?error=access_denied",
				),
			});
			const auth = await initOAuthAuth(deps);

			await expect(auth.login()).rejects.toThrow("OAuth authorization denied");
		});

		it("should throw when callback has no code", async () => {
			const deps = createMockDeps({
				waitForRedirect: jest.fn().mockResolvedValue(
					"http://localhost:3000/oauth/callback?state=anything",
				),
			});
			const auth = await initOAuthAuth(deps);

			await expect(auth.login()).rejects.toThrow("No authorization code");
		});

		it("should throw on state mismatch", async () => {
			const deps = createMockDeps({
				waitForRedirect: jest.fn().mockResolvedValue(
					"http://localhost:3000/oauth/callback?code=test-code&state=wrong-state",
				),
			});
			const auth = await initOAuthAuth(deps);

			await expect(auth.login()).rejects.toThrow("state mismatch");
		});

		it("should throw when token exchange fails", async () => {
			const deps = createMockDeps({
				fetchFn: jest.fn().mockResolvedValue({ ok: false, status: 400 }),
			});
			const auth = await initOAuthAuth(deps);

			await expect(auth.login()).rejects.toThrow("Token exchange failed");
		});
	});

	describe("logout", () => {
		it("should revoke tokens on the server", async () => {
			const tokenStorage = createMockTokenStorage();
			const deps = createMockDeps({ tokenStorage });
			const auth = await initOAuthAuth(deps);

			await auth.login();
			(deps.fetchFn as jest.Mock).mockClear();

			await auth.logout();

			expect(deps.fetchFn).toHaveBeenCalledWith(
				"http://localhost:3000/oauth/revoke",
				expect.objectContaining({
					method: "POST",
					body: JSON.stringify({ token: "refresh-456" }),
				}),
			);
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
