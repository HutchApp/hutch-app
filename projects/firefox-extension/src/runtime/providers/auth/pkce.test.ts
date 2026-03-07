import { generateCodeVerifier, generateCodeChallenge } from "./pkce";

describe("generateCodeVerifier", () => {
	it("should return a base64url-encoded string of at least 43 characters", () => {
		const verifier = generateCodeVerifier();

		expect(verifier.length).toBeGreaterThanOrEqual(43);
		expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
	});

	it("should generate unique values on each call", () => {
		const a = generateCodeVerifier();
		const b = generateCodeVerifier();

		expect(a).not.toBe(b);
	});
});

describe("generateCodeChallenge", () => {
	it("should produce a base64url-encoded SHA-256 hash of the verifier", async () => {
		const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";

		const challenge = await generateCodeChallenge(verifier);

		expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(challenge.length).toBe(43);
	});

	it("should produce the same challenge for the same verifier", async () => {
		const verifier = generateCodeVerifier();

		const challenge1 = await generateCodeChallenge(verifier);
		const challenge2 = await generateCodeChallenge(verifier);

		expect(challenge1).toBe(challenge2);
	});

	it("should produce different challenges for different verifiers", async () => {
		const challenge1 = await generateCodeChallenge("verifier-one-abc123");
		const challenge2 = await generateCodeChallenge("verifier-two-xyz789");

		expect(challenge1).not.toBe(challenge2);
	});
});
