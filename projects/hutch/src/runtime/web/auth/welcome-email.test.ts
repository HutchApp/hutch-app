import { buildWelcomeEmailHtml } from "./welcome-email";

describe("buildWelcomeEmailHtml", () => {
	it("includes the install URL in the call-to-action link", () => {
		const html = buildWelcomeEmailHtml({ installUrl: "https://readplace.com/install" });

		expect(html).toContain('href="https://readplace.com/install"');
	});

	it("escapes HTML entities in the install URL to prevent injection", () => {
		const html = buildWelcomeEmailHtml({
			installUrl: 'https://example.com/install?a=1&b=2"<>',
		});

		expect(html).toContain('href="https://example.com/install?a=1&amp;b=2&quot;&lt;&gt;"');
	});

	it("renders the welcome heading", () => {
		const html = buildWelcomeEmailHtml({ installUrl: "https://readplace.com/install" });

		expect(html).toContain("Welcome to Readplace");
	});

	it("invites the recipient to reply directly with feedback", () => {
		const html = buildWelcomeEmailHtml({ installUrl: "https://readplace.com/install" });

		expect(html).toContain("reply to this email");
	});

	it("produces a complete HTML document", () => {
		const html = buildWelcomeEmailHtml({ installUrl: "https://readplace.com/install" });

		expect(html).toContain("<!DOCTYPE html>");
		expect(html).toContain("</html>");
	});
});
