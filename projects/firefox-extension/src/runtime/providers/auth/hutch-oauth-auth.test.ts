import {
	initHutchOAuthAuth,
	createBrowserWindowApi,
} from "./hutch-oauth-auth";

type TabUpdatedCallback = (
	tabId: number,
	changeInfo: { url?: string },
) => void;
type WindowRemovedCallback = (windowId: number) => void;

function createTestDeps() {
	const tabListeners: TabUpdatedCallback[] = [];
	const windowRemovedListeners: WindowRemovedCallback[] = [];
	let windowIdCounter = 1;
	let fetchResponse: { ok: boolean; body: Record<string, unknown> } = {
		ok: true,
		body: {
			access_token: "test-access-token",
			refresh_token: "test-refresh-token",
			expires_in: 3600,
		},
	};

	let resolveListenersReady: () => void;
	const listenersReady = new Promise<void>((resolve) => {
		resolveListenersReady = resolve;
	});

	const createWindow = jest.fn(
		async (_params: Record<string, unknown>): Promise<{ id?: number }> => {
			return { id: windowIdCounter++ };
		},
	);
	const removeWindow = jest.fn(async () => {});
	const fetchFn = jest.fn(async () => ({
		ok: fetchResponse.ok,
		json: async () => fetchResponse.body,
	})) as unknown as typeof fetch;

	const windowApi = {
		createWindow,
		removeWindow,
		onTabUpdated: {
			addListener: jest.fn((cb: TabUpdatedCallback) => {
				tabListeners.push(cb);
				resolveListenersReady();
			}),
			removeListener: jest.fn((cb: TabUpdatedCallback) => {
				const index = tabListeners.indexOf(cb);
				if (index >= 0) tabListeners.splice(index, 1);
			}),
		},
		onWindowRemoved: {
			addListener: jest.fn((cb: WindowRemovedCallback) => {
				windowRemovedListeners.push(cb);
			}),
			removeListener: jest.fn((cb: WindowRemovedCallback) => {
				const index = windowRemovedListeners.indexOf(cb);
				if (index >= 0) windowRemovedListeners.splice(index, 1);
			}),
		},
	};

	return {
		windowApi,
		createWindow,
		fetchFn,
		listenersReady,
		setFetchResponse(response: {
			ok: boolean;
			body: Record<string, unknown>;
		}) {
			fetchResponse = response;
		},
		simulateCallback(url: string) {
			for (const cb of [...tabListeners]) {
				cb(1, { url });
			}
		},
		simulateWindowClosed(windowId: number) {
			for (const cb of [...windowRemovedListeners]) {
				cb(windowId);
			}
		},
	};
}

describe("createBrowserWindowApi", () => {
	it("should delegate to browser APIs", () => {
		const mockCreate = jest.fn();
		const mockRemove = jest.fn();
		const mockOnUpdated = {
			addListener: jest.fn(),
			removeListener: jest.fn(),
		};
		const mockOnRemoved = {
			addListener: jest.fn(),
			removeListener: jest.fn(),
		};

		(globalThis as Record<string, unknown>).browser = {
			windows: {
				create: mockCreate,
				remove: mockRemove,
				onRemoved: mockOnRemoved,
			},
			tabs: {
				onUpdated: mockOnUpdated,
			},
		};

		const api = createBrowserWindowApi();

		api.createWindow({
			url: "https://example.com",
			type: "popup",
			width: 500,
			height: 700,
		});
		expect(mockCreate).toHaveBeenCalledWith({
			url: "https://example.com",
			type: "popup",
			width: 500,
			height: 700,
		});

		api.removeWindow(42);
		expect(mockRemove).toHaveBeenCalledWith(42);

		expect(api.onTabUpdated).toBe(mockOnUpdated);
		expect(api.onWindowRemoved).toBe(mockOnRemoved);

		delete (globalThis as Record<string, unknown>).browser;
	});
});

describe("initHutchOAuthAuth", () => {
	const serverUrl = "https://hutch-app.com";

	describe("login + whenLoggedIn", () => {
		it("should complete OAuth flow and allow guarded calls", async () => {
			const deps = createTestDeps();
			const auth = initHutchOAuthAuth({
				serverUrl,
				windowApi: deps.windowApi,
				fetchFn: deps.fetchFn,
			});

			const loginPromise = auth.login();
			await deps.listenersReady;

			const authUrl =
				deps.createWindow.mock.calls[0]?.[0]?.url as string;
			const state = new URL(authUrl).searchParams.get("state");
			deps.simulateCallback(
				`${serverUrl}/oauth/callback?code=test-code&state=${state}`,
			);

			const result = await loginPromise;

			expect(result).toEqual({ ok: true });

			const guarded = auth.whenLoggedIn(() => "protected-value");
			expect(guarded).toEqual({ ok: true, value: "protected-value" });
		});
	});

	describe("login opens OAuth authorization window", () => {
		it("should open a popup window with the correct OAuth URL", async () => {
			const deps = createTestDeps();
			const auth = initHutchOAuthAuth({
				serverUrl,
				windowApi: deps.windowApi,
				fetchFn: deps.fetchFn,
			});

			const loginPromise = auth.login();
			await deps.listenersReady;

			const createCall = deps.createWindow.mock.calls[0]?.[0];
			expect(createCall?.type).toBe("popup");
			expect(createCall?.width).toBe(500);
			expect(createCall?.height).toBe(700);

			const authUrl = new URL(createCall?.url as string);
			expect(authUrl.origin + authUrl.pathname).toBe(
				`${serverUrl}/oauth/authorize`,
			);
			expect(authUrl.searchParams.get("client_id")).toBe(
				"hutch-firefox-extension",
			);
			expect(authUrl.searchParams.get("response_type")).toBe("code");
			expect(authUrl.searchParams.get("code_challenge_method")).toBe(
				"S256",
			);
			expect(
				authUrl.searchParams.get("code_challenge")?.length,
			).toBeGreaterThanOrEqual(43);

			const state = authUrl.searchParams.get("state");
			deps.simulateCallback(
				`${serverUrl}/oauth/callback?code=test-code&state=${state}`,
			);

			await loginPromise;
		});
	});

	describe("login exchanges authorization code for tokens", () => {
		it("should POST to /oauth/token with correct parameters", async () => {
			const deps = createTestDeps();
			const auth = initHutchOAuthAuth({
				serverUrl,
				windowApi: deps.windowApi,
				fetchFn: deps.fetchFn,
			});

			const loginPromise = auth.login();
			await deps.listenersReady;

			const authUrl = new URL(
				deps.createWindow.mock.calls[0]?.[0]?.url as string,
			);
			const state = authUrl.searchParams.get("state");
			deps.simulateCallback(
				`${serverUrl}/oauth/callback?code=auth-code-123&state=${state}`,
			);

			await loginPromise;

			expect(deps.fetchFn).toHaveBeenCalledTimes(1);
			const [fetchUrl, fetchOptions] = (deps.fetchFn as jest.Mock).mock
				.calls[0];
			expect(fetchUrl).toBe(`${serverUrl}/oauth/token`);
			expect(fetchOptions.method).toBe("POST");

			const body = new URLSearchParams(fetchOptions.body);
			expect(body.get("grant_type")).toBe("authorization_code");
			expect(body.get("code")).toBe("auth-code-123");
			expect(body.get("client_id")).toBe("hutch-firefox-extension");
			expect(body.get("code_verifier")?.length).toBeGreaterThanOrEqual(
				43,
			);
		});
	});

	describe("login fails when user denies authorization", () => {
		it("should return invalid-credentials when callback has error", async () => {
			const deps = createTestDeps();
			const auth = initHutchOAuthAuth({
				serverUrl,
				windowApi: deps.windowApi,
				fetchFn: deps.fetchFn,
			});

			const loginPromise = auth.login();
			await deps.listenersReady;

			const authUrl = new URL(
				deps.createWindow.mock.calls[0]?.[0]?.url as string,
			);
			const state = authUrl.searchParams.get("state");
			deps.simulateCallback(
				`${serverUrl}/oauth/callback?error=access_denied&state=${state}`,
			);

			const result = await loginPromise;

			expect(result).toEqual({
				ok: false,
				reason: "invalid-credentials",
			});
		});
	});

	describe("login fails when user closes window", () => {
		it("should return invalid-credentials when window is closed", async () => {
			const deps = createTestDeps();
			const auth = initHutchOAuthAuth({
				serverUrl,
				windowApi: deps.windowApi,
				fetchFn: deps.fetchFn,
			});

			const loginPromise = auth.login();
			await deps.listenersReady;
			deps.simulateWindowClosed(1);

			const result = await loginPromise;

			expect(result).toEqual({
				ok: false,
				reason: "invalid-credentials",
			});
		});
	});

	describe("login fails when token exchange fails", () => {
		it("should return invalid-credentials when /oauth/token returns error", async () => {
			const deps = createTestDeps();
			deps.setFetchResponse({ ok: false, body: {} });
			const auth = initHutchOAuthAuth({
				serverUrl,
				windowApi: deps.windowApi,
				fetchFn: deps.fetchFn,
			});

			const loginPromise = auth.login();
			await deps.listenersReady;

			const authUrl = new URL(
				deps.createWindow.mock.calls[0]?.[0]?.url as string,
			);
			const state = authUrl.searchParams.get("state");
			deps.simulateCallback(
				`${serverUrl}/oauth/callback?code=test-code&state=${state}`,
			);

			const result = await loginPromise;

			expect(result).toEqual({
				ok: false,
				reason: "invalid-credentials",
			});
		});
	});

	describe("whenLoggedIn allows calls when access token expired but refresh token exists", () => {
		it("should pass the guard when refresh token is available", async () => {
			const deps = createTestDeps();
			deps.setFetchResponse({
				ok: true,
				body: {
					access_token: "initial-token",
					refresh_token: "test-refresh-token",
					expires_in: 0,
				},
			});
			const auth = initHutchOAuthAuth({
				serverUrl,
				windowApi: deps.windowApi,
				fetchFn: deps.fetchFn,
			});

			const loginPromise = auth.login();
			await deps.listenersReady;
			const authUrl = new URL(
				deps.createWindow.mock.calls[0]?.[0]?.url as string,
			);
			const state = authUrl.searchParams.get("state");
			deps.simulateCallback(
				`${serverUrl}/oauth/callback?code=test-code&state=${state}`,
			);
			await loginPromise;

			const guarded = auth.whenLoggedIn(() => "protected-value");
			expect(guarded).toEqual({ ok: true, value: "protected-value" });
		});
	});

	describe("whenLoggedIn without login", () => {
		it("should return not-logged-in", () => {
			const deps = createTestDeps();
			const auth = initHutchOAuthAuth({
				serverUrl,
				windowApi: deps.windowApi,
				fetchFn: deps.fetchFn,
			});

			const result = auth.whenLoggedIn(() => "value");

			expect(result).toEqual({ ok: false, reason: "not-logged-in" });
		});
	});

	describe("whenLoggedIn callback throws", () => {
		it("should catch the error and return it", async () => {
			const deps = createTestDeps();
			const auth = initHutchOAuthAuth({
				serverUrl,
				windowApi: deps.windowApi,
				fetchFn: deps.fetchFn,
			});

			const loginPromise = auth.login();
			await deps.listenersReady;
			const authUrl = new URL(
				deps.createWindow.mock.calls[0]?.[0]?.url as string,
			);
			const state = authUrl.searchParams.get("state");
			deps.simulateCallback(
				`${serverUrl}/oauth/callback?code=test-code&state=${state}`,
			);
			await loginPromise;

			const thrownError = new Error("callback failed");
			const result = auth.whenLoggedIn(() => {
				throw thrownError;
			});

			expect(result.ok).toBe(false);
			if (!result.ok && result.reason === "error") {
				expect(result.error).toBe(thrownError);
			}
		});
	});

	describe("logout", () => {
		it("should revoke tokens and return not-logged-in on subsequent calls", async () => {
			const deps = createTestDeps();
			const auth = initHutchOAuthAuth({
				serverUrl,
				windowApi: deps.windowApi,
				fetchFn: deps.fetchFn,
			});

			const loginPromise = auth.login();
			await deps.listenersReady;
			const authUrl = new URL(
				deps.createWindow.mock.calls[0]?.[0]?.url as string,
			);
			const state = authUrl.searchParams.get("state");
			deps.simulateCallback(
				`${serverUrl}/oauth/callback?code=test-code&state=${state}`,
			);
			await loginPromise;

			await auth.logout();

			const guarded = auth.whenLoggedIn(() => "value");
			expect(guarded).toEqual({ ok: false, reason: "not-logged-in" });

			expect(deps.fetchFn).toHaveBeenCalledTimes(2);
			const [revokeUrl, revokeOptions] = (deps.fetchFn as jest.Mock).mock
				.calls[1];
			expect(revokeUrl).toBe(`${serverUrl}/oauth/revoke`);
			expect(revokeOptions.method).toBe("POST");
			const body = new URLSearchParams(revokeOptions.body);
			expect(body.get("token")).toBe("test-refresh-token");
		});
	});

	describe("login fails when window has no id", () => {
		it("should return invalid-credentials when createWindow returns no id", async () => {
			const deps = createTestDeps();
			deps.createWindow.mockResolvedValueOnce({ id: undefined });
			const auth = initHutchOAuthAuth({
				serverUrl,
				windowApi: deps.windowApi,
				fetchFn: deps.fetchFn,
			});

			const result = await auth.login();

			expect(result).toEqual({
				ok: false,
				reason: "invalid-credentials",
			});
		});
	});

	describe("whenLoggedIn callback throws non-Error value", () => {
		it("should wrap non-Error thrown values", async () => {
			const deps = createTestDeps();
			const auth = initHutchOAuthAuth({
				serverUrl,
				windowApi: deps.windowApi,
				fetchFn: deps.fetchFn,
			});

			const loginPromise = auth.login();
			await deps.listenersReady;
			const authUrl = new URL(
				deps.createWindow.mock.calls[0]?.[0]?.url as string,
			);
			const state = authUrl.searchParams.get("state");
			deps.simulateCallback(
				`${serverUrl}/oauth/callback?code=test-code&state=${state}`,
			);
			await loginPromise;

			const result = auth.whenLoggedIn(() => {
				throw "string-error";
			});

			expect(result.ok).toBe(false);
			if (!result.ok && result.reason === "error") {
				expect(result.error).toBeInstanceOf(Error);
				expect(result.error.message).toBe("string-error");
			}
		});
	});

	describe("logout without refresh token", () => {
		it("should clear tokens without calling revoke endpoint", async () => {
			const deps = createTestDeps();
			deps.setFetchResponse({
				ok: true,
				body: {
					access_token: "test-access-token",
					expires_in: 3600,
				},
			});
			const auth = initHutchOAuthAuth({
				serverUrl,
				windowApi: deps.windowApi,
				fetchFn: deps.fetchFn,
			});

			const loginPromise = auth.login();
			await deps.listenersReady;
			const authUrl = new URL(
				deps.createWindow.mock.calls[0]?.[0]?.url as string,
			);
			const state = authUrl.searchParams.get("state");
			deps.simulateCallback(
				`${serverUrl}/oauth/callback?code=test-code&state=${state}`,
			);
			await loginPromise;

			await auth.logout();

			expect(deps.fetchFn).toHaveBeenCalledTimes(1);
			const guarded = auth.whenLoggedIn(() => "value");
			expect(guarded).toEqual({ ok: false, reason: "not-logged-in" });
		});
	});

	describe("waitForOAuthCallback ignores unrelated events", () => {
		it("should ignore tab updates for different URLs", async () => {
			const deps = createTestDeps();
			const auth = initHutchOAuthAuth({
				serverUrl,
				windowApi: deps.windowApi,
				fetchFn: deps.fetchFn,
			});

			const loginPromise = auth.login();
			await deps.listenersReady;

			deps.simulateCallback("https://other-site.com/page");
			deps.simulateCallback("");

			const authUrl = new URL(
				deps.createWindow.mock.calls[0]?.[0]?.url as string,
			);
			const state = authUrl.searchParams.get("state");

			deps.simulateCallback(
				`${serverUrl}/oauth/callback?code=test-code&state=wrong-state`,
			);

			deps.simulateCallback(
				`${serverUrl}/oauth/callback?code=test-code&state=${state}`,
			);

			const result = await loginPromise;
			expect(result).toEqual({ ok: true });
		});

		it("should ignore window removal for different window ids", async () => {
			const deps = createTestDeps();
			const auth = initHutchOAuthAuth({
				serverUrl,
				windowApi: deps.windowApi,
				fetchFn: deps.fetchFn,
			});

			const loginPromise = auth.login();
			await deps.listenersReady;

			deps.simulateWindowClosed(999);

			const authUrl = new URL(
				deps.createWindow.mock.calls[0]?.[0]?.url as string,
			);
			const state = authUrl.searchParams.get("state");
			deps.simulateCallback(
				`${serverUrl}/oauth/callback?code=test-code&state=${state}`,
			);

			const result = await loginPromise;
			expect(result).toEqual({ ok: true });
		});

		it("should ignore tab updates without url", async () => {
			const deps = createTestDeps();
			const auth = initHutchOAuthAuth({
				serverUrl,
				windowApi: deps.windowApi,
				fetchFn: deps.fetchFn,
			});

			const loginPromise = auth.login();
			await deps.listenersReady;

			deps.simulateCallback(undefined as unknown as string);

			const authUrl = new URL(
				deps.createWindow.mock.calls[0]?.[0]?.url as string,
			);
			const state = authUrl.searchParams.get("state");
			deps.simulateCallback(
				`${serverUrl}/oauth/callback?code=test-code&state=${state}`,
			);

			const result = await loginPromise;
			expect(result).toEqual({ ok: true });
		});
	});

	describe("getAccessToken", () => {
		it("should return the access token after login", async () => {
			const deps = createTestDeps();
			const auth = initHutchOAuthAuth({
				serverUrl,
				windowApi: deps.windowApi,
				fetchFn: deps.fetchFn,
			});

			const loginPromise = auth.login();
			await deps.listenersReady;
			const authUrl = new URL(
				deps.createWindow.mock.calls[0]?.[0]?.url as string,
			);
			const state = authUrl.searchParams.get("state");
			deps.simulateCallback(
				`${serverUrl}/oauth/callback?code=test-code&state=${state}`,
			);
			await loginPromise;

			expect(await auth.getAccessToken()).toBe("test-access-token");
		});

		it("should return null when not logged in", async () => {
			const deps = createTestDeps();
			const auth = initHutchOAuthAuth({
				serverUrl,
				windowApi: deps.windowApi,
				fetchFn: deps.fetchFn,
			});

			expect(await auth.getAccessToken()).toBeNull();
		});
	});

	describe("token refresh", () => {
		it("should refresh the access token when expired but refresh token exists", async () => {
			const deps = createTestDeps();
			deps.setFetchResponse({
				ok: true,
				body: {
					access_token: "initial-token",
					refresh_token: "test-refresh-token",
					expires_in: 0,
				},
			});
			const auth = initHutchOAuthAuth({
				serverUrl,
				windowApi: deps.windowApi,
				fetchFn: deps.fetchFn,
			});

			const loginPromise = auth.login();
			await deps.listenersReady;
			const authUrl = new URL(
				deps.createWindow.mock.calls[0]?.[0]?.url as string,
			);
			const state = authUrl.searchParams.get("state");
			deps.simulateCallback(
				`${serverUrl}/oauth/callback?code=test-code&state=${state}`,
			);
			await loginPromise;

			deps.setFetchResponse({
				ok: true,
				body: {
					access_token: "refreshed-token",
					refresh_token: "new-refresh-token",
					expires_in: 3600,
				},
			});

			const token = await auth.getAccessToken();
			expect(token).toBe("refreshed-token");

			const [refreshUrl, refreshOptions] = (deps.fetchFn as jest.Mock)
				.mock.calls[1];
			expect(refreshUrl).toBe(`${serverUrl}/oauth/token`);
			expect(refreshOptions.method).toBe("POST");
			const body = new URLSearchParams(refreshOptions.body);
			expect(body.get("grant_type")).toBe("refresh_token");
			expect(body.get("refresh_token")).toBe("test-refresh-token");
			expect(body.get("client_id")).toBe("hutch-firefox-extension");
		});

		it("should return null when refresh fails", async () => {
			const deps = createTestDeps();
			deps.setFetchResponse({
				ok: true,
				body: {
					access_token: "initial-token",
					refresh_token: "test-refresh-token",
					expires_in: 0,
				},
			});
			const auth = initHutchOAuthAuth({
				serverUrl,
				windowApi: deps.windowApi,
				fetchFn: deps.fetchFn,
			});

			const loginPromise = auth.login();
			await deps.listenersReady;
			const authUrl = new URL(
				deps.createWindow.mock.calls[0]?.[0]?.url as string,
			);
			const state = authUrl.searchParams.get("state");
			deps.simulateCallback(
				`${serverUrl}/oauth/callback?code=test-code&state=${state}`,
			);
			await loginPromise;

			deps.setFetchResponse({ ok: false, body: {} });

			const token = await auth.getAccessToken();
			expect(token).toBeNull();
		});

		it("should return null when no refresh token and access token expired", async () => {
			const deps = createTestDeps();
			deps.setFetchResponse({
				ok: true,
				body: {
					access_token: "initial-token",
					expires_in: 0,
				},
			});
			const auth = initHutchOAuthAuth({
				serverUrl,
				windowApi: deps.windowApi,
				fetchFn: deps.fetchFn,
			});

			const loginPromise = auth.login();
			await deps.listenersReady;
			const authUrl = new URL(
				deps.createWindow.mock.calls[0]?.[0]?.url as string,
			);
			const state = authUrl.searchParams.get("state");
			deps.simulateCallback(
				`${serverUrl}/oauth/callback?code=test-code&state=${state}`,
			);
			await loginPromise;

			const token = await auth.getAccessToken();
			expect(token).toBeNull();

			expect(deps.fetchFn).toHaveBeenCalledTimes(1);
		});
	});
});
