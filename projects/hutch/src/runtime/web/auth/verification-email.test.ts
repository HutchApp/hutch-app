import { buildVerificationEmailHtml } from "./verification-email";

describe("buildVerificationEmailHtml", () => {
	it("includes the verify URL in the email link", () => {
		const html = buildVerificationEmailHtml("https://hutch-app.com/verify?token=abc123");

		expect(html).toContain('href="https://hutch-app.com/verify?token=abc123"');
	});

	it("escapes HTML entities in the URL to prevent injection", () => {
		const html = buildVerificationEmailHtml('https://example.com/verify?a=1&b=2"<>');

		expect(html).toContain("&amp;");
		expect(html).toContain("&quot;");
		expect(html).toContain("&lt;");
		expect(html).toContain("&gt;");
		expect(html).not.toContain('&b=2"');
	});

	it("renders the email subject heading", () => {
		const html = buildVerificationEmailHtml("https://hutch-app.com/verify");

		expect(html).toContain("Verify your email");
	});

	it("produces a complete HTML document", () => {
		const html = buildVerificationEmailHtml("https://hutch-app.com/verify");

		expect(html).toContain("<!DOCTYPE html>");
		expect(html).toContain("</html>");
	});
});
