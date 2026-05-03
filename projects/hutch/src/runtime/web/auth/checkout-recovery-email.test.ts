import { buildCheckoutRecoveryEmail } from "./checkout-recovery-email";

describe("buildCheckoutRecoveryEmail", () => {
	const baseParams = {
		founderAvatarUrl: "https://readplace.com/fayner-brack.jpg",
		resumeUrl: "https://readplace.com/signup?email=jane%40example.com&utm_source=recovery",
	};

	it("includes the resume URL on the CTA anchor", () => {
		const { html } = buildCheckoutRecoveryEmail(baseParams);

		expect(html).toContain(
			'href="https://readplace.com/signup?email=jane%40example.com&amp;utm_source=recovery"',
		);
		expect(html).toContain(">Resume your trial</a>");
	});

	it("renders the founder avatar with the absolute URL", () => {
		const { html } = buildCheckoutRecoveryEmail(baseParams);

		expect(html).toContain('src="https://readplace.com/fayner-brack.jpg"');
		expect(html).toContain('alt="Fayner Brack"');
		expect(html).toContain("border-radius:50%");
	});

	it("escapes HTML entities in the avatar and resume URLs", () => {
		const { html } = buildCheckoutRecoveryEmail({
			founderAvatarUrl: 'https://readplace.com/avatar.jpg?"<>&',
			resumeUrl: 'https://readplace.com/signup?email=a&b="<>',
		});

		expect(html).toContain('src="https://readplace.com/avatar.jpg?&quot;&lt;&gt;&amp;"');
		expect(html).toContain(
			'href="https://readplace.com/signup?email=a&amp;b=&quot;&lt;&gt;"',
		);
	});

	it("produces a complete HTML document with the subject heading content", () => {
		const { html } = buildCheckoutRecoveryEmail(baseParams);

		expect(html).toContain("<!DOCTYPE html>");
		expect(html).toContain("</html>");
		expect(html).toContain("Did something stop you?");
	});

	it("returns a plain-text body containing the resume URL on its own line", () => {
		const { text } = buildCheckoutRecoveryEmail(baseParams);

		const lines = text.split("\n");
		expect(lines).toContain(
			"https://readplace.com/signup?email=jane%40example.com&utm_source=recovery",
		);
		expect(text).toContain("Hi there,");
		expect(text).toContain("— Fayner");
		expect(text).toContain("readplace.com");
		expect(text).toContain("If you'd rather not hear from me, just reply STOP.");
	});
});
