import { getClient, validateRedirectUri } from "./oauth-clients";

describe("getClient", () => {
	it("returns the registered Firefox extension client", () => {
		const client = getClient("hutch-firefox-extension");

		expect(client).toBeDefined();
		expect(client?.name).toBe("Hutch Firefox Extension");
		expect(client?.grants).toContain("authorization_code");
		expect(client?.grants).toContain("refresh_token");
	});

	it("returns undefined for an unknown client ID", () => {
		const client = getClient("unknown-client");

		expect(client).toBeUndefined();
	});
});

describe("validateRedirectUri", () => {
	it("accepts a registered redirect URI", () => {
		const valid = validateRedirectUri({
			clientId: "hutch-firefox-extension",
			redirectUri: "http://127.0.0.1:3000/oauth/callback",
		});

		expect(valid).toBe(true);
	});

	it("rejects an unregistered redirect URI", () => {
		const valid = validateRedirectUri({
			clientId: "hutch-firefox-extension",
			redirectUri: "https://evil.com/steal-token",
		});

		expect(valid).toBe(false);
	});

	it("rejects when client does not exist", () => {
		const valid = validateRedirectUri({
			clientId: "nonexistent-client",
			redirectUri: "http://127.0.0.1:3000/oauth/callback",
		});

		expect(valid).toBe(false);
	});
});
