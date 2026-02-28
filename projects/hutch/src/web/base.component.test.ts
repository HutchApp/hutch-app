import { JSDOM } from "jsdom";
import { Base, type PageContent } from "./base.component";

function createTestPageContent(overrides: Partial<PageContent> = {}): PageContent {
	return {
		seo: {
			title: "Test Page",
			description: "Test description",
			canonicalUrl: "https://hutchreader.com/test",
		},
		styles: "",
		content: "<main><p>Test content</p></main>",
		...overrides,
	};
}

describe("Base component", () => {
	it("should render a complete HTML page with the provided title", () => {
		const page = createTestPageContent({ seo: { title: "My Title", description: "Desc", canonicalUrl: "https://hutchreader.com" } });
		const result = Base(page).to("text/html");

		expect(result.statusCode).toBe(200);
		const doc = new JSDOM(result.body).window.document;
		expect(doc.title).toBe("My Title");
	});

	it("should render the Hutch brand name in the header", () => {
		const page = createTestPageContent();
		const result = Base(page).to("text/html");
		const doc = new JSDOM(result.body).window.document;

		const brand = doc.querySelector(".header__brand") as HTMLAnchorElement;
		expect(brand.textContent).toBe("Hutch");
		expect(brand.getAttribute("href")).toBe("/");
	});

	it("should include page content in the body", () => {
		const page = createTestPageContent({ content: "<main><h1>Hello World</h1></main>" });
		const result = Base(page).to("text/html");
		const doc = new JSDOM(result.body).window.document;

		const heading = doc.querySelector("main h1");
		expect(heading?.textContent).toBe("Hello World");
	});

	it("should apply bodyClass when provided", () => {
		const page = createTestPageContent({ bodyClass: "page-landing" });
		const result = Base(page).to("text/html");
		const doc = new JSDOM(result.body).window.document;

		expect(doc.body.classList.contains("page-landing")).toBe(true);
	});

	it("should include navigation links", () => {
		const page = createTestPageContent();
		const result = Base(page).to("text/html");
		const doc = new JSDOM(result.body).window.document;

		const navLinks = doc.querySelectorAll(".nav__link");
		expect(navLinks.length).toBeGreaterThan(0);
	});

	it("should include the footer with copyright", () => {
		const page = createTestPageContent();
		const result = Base(page).to("text/html");
		const doc = new JSDOM(result.body).window.document;

		const footer = doc.querySelector(".footer__copyright");
		expect(footer?.textContent).toContain("Hutch");
	});

	it("should include the offline banner", () => {
		const page = createTestPageContent();
		const result = Base(page).to("text/html");
		const doc = new JSDOM(result.body).window.document;

		const banner = doc.querySelector(".offline-banner");
		expect(banner).not.toBeNull();
		expect(banner?.getAttribute("aria-hidden")).toBe("true");
	});

	it("should set meta description from seo", () => {
		const page = createTestPageContent({ seo: { title: "T", description: "My desc", canonicalUrl: "https://hutchreader.com" } });
		const result = Base(page).to("text/html");
		const doc = new JSDOM(result.body).window.document;

		const meta = doc.querySelector('meta[name="description"]');
		expect(meta?.getAttribute("content")).toBe("My desc");
	});

	it("should render structured data when provided", () => {
		const page = createTestPageContent({
			seo: {
				title: "T",
				description: "D",
				canonicalUrl: "https://hutchreader.com",
				structuredData: [{ "@context": "https://schema.org", "@type": "WebSite", name: "Hutch" }],
			},
		});
		const result = Base(page).to("text/html");
		const doc = new JSDOM(result.body).window.document;

		const ldJson = doc.querySelector('script[type="application/ld+json"]');
		expect(ldJson).not.toBeNull();
		const data = JSON.parse(ldJson?.textContent || "{}");
		expect(data.name).toBe("Hutch");
	});
});
