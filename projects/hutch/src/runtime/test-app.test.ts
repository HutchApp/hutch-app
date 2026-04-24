import request from "supertest";
import { GoogleIdSchema } from "./providers/google-auth/google-auth.schema";
import { createTestAppFromFixture } from "./test-app";
import { createDefaultTestAppFixture } from "./test-app-fakes";

describe("createTestAppFromFixture + createDefaultTestAppFixture", () => {
	it("produces a working app with default in-memory dependencies", async () => {
		const { app } = createTestAppFromFixture(createDefaultTestAppFixture());

		const response = await request(app).get("/");

		expect(response.status).toBe(200);
		expect(response.headers["content-type"]).toMatch(/text\/html/);
	});

	it("exposes back-compat handles so tests can drive state directly", async () => {
		const result = createTestAppFromFixture(createDefaultTestAppFixture());

		expect(typeof result.auth.createUser).toBe("function");
		expect(typeof result.articleStore.writeContent).toBe("function");
		expect(typeof result.articleStore.writeMetadata).toBe("function");
		expect(typeof result.articleCrawl.markCrawlReady).toBe("function");
		expect(typeof result.articleCrawl.markCrawlFailed).toBe("function");
		expect(typeof result.oauthModel.getClient).toBe("function");
		expect(typeof result.email.getSentEmails).toBe("function");
		expect(typeof result.emailVerification.createVerificationToken).toBe("function");
		expect(typeof result.passwordReset.createPasswordResetToken).toBe("function");

		expect(
			await result.articleStore.readArticleContent("https://example.com/article"),
		).toBeUndefined();
	});

	it("wires Google auth when an exchangeGoogleCode override is provided", () => {
		const fixture = createDefaultTestAppFixture({
			exchangeGoogleCode: async () => ({
				googleId: GoogleIdSchema.parse("google-sub"),
				email: "user@example.com",
				emailVerified: true,
			}),
		});

		expect(fixture.google).toBeDefined();
		expect(fixture.google?.clientId).toBe("test-google-client-id");
	});

	it("defaults google to undefined when no exchangeGoogleCode is provided", () => {
		const fixture = createDefaultTestAppFixture();

		expect(fixture.google).toBeUndefined();
	});

	it("uses the appOrigin override for shared.appOrigin", () => {
		const fixture = createDefaultTestAppFixture({ appOrigin: "http://127.0.0.1:4000" });

		expect(fixture.shared.appOrigin).toBe("http://127.0.0.1:4000");
	});
});
