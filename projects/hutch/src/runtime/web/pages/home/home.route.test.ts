import { JSDOM } from "jsdom";
import request from "supertest";
import { createTestApp } from "../../../test-app";

describe("GET /", () => {
	const { app } = createTestApp();

	it("should return 200 and HTML content", async () => {
		const response = await request(app).get("/");
		expect(response.status).toBe(200);
		expect(response.headers["content-type"]).toMatch(/text\/html/);
	});

	it("should render the hero section with main tagline", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		const heroTitle = doc.querySelector(".home-hero__title");
		expect(heroTitle?.textContent).toContain("Save now.");
		expect(heroTitle?.textContent).toContain("Read later.");
		expect(heroTitle?.textContent).toContain("That's it.");
	});

	it("should render the primary CTA linking to extension install", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		const cta = doc.querySelector('[data-test-cta="install-extension"]') as HTMLAnchorElement;
		expect(cta.getAttribute("href")).toBe("/install");
		expect(cta.textContent).toBe("Install the Firefox Extension");
	});

	it("should render the core features section with shipped features only", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		const coreSection = doc.querySelector('[data-test-section="core-features"]');
		const features = coreSection?.querySelectorAll(".feature-card");
		expect(features?.length).toBe(3);
	});

	it("should render the roadmap section with planned features", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		const roadmapSection = doc.querySelector('[data-test-section="roadmap"]');
		const features = roadmapSection?.querySelectorAll(".feature-card");
		expect(features?.length).toBe(5);
	});

	it("should render the backstory section", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		const backstoryTitle = doc.querySelector('[data-test-section="backstory"] .home-backstory__title');
		expect(backstoryTitle?.textContent).toContain("Why I built this");
	});

	it("should render one pricing plan for founding members", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		const pricingSection = doc.querySelector('[data-test-section="pricing"]');
		const plans = pricingSection?.querySelectorAll(".pricing-card");
		expect(plans?.length).toBe(1);
		expect(doc.querySelector('[data-test-plan="founding"] .pricing-card__name')?.textContent).toBe("Founding Member");
		expect(doc.querySelector('[data-test-plan="founding"] .pricing-card__price')?.textContent).toContain("A$0");
	});

	it("should render the comparison table", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		const table = doc.querySelector("[data-test-comparison-table]");
		const rows = table?.querySelectorAll("tbody tr");
		expect(rows?.length).toBe(3);
	});

	it("should render the trust section with two trust items", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		const trustSection = doc.querySelector('[data-test-section="trust"]');
		const cards = trustSection?.querySelectorAll(".trust-card");
		expect(cards?.length).toBe(1);
	});


	it("should have page-home body class", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		expect(doc.body.classList.contains("page-home")).toBe(true);
	});

	it("should set appropriate SEO metadata", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		expect(doc.title).toContain("Hutch");
		const description = doc.querySelector('meta[name="description"]');
		expect(description?.getAttribute("content")).toContain("read-it-later");
	});
});

describe("GET /nonexistent", () => {
	const { app } = createTestApp();

	it("should return 404", async () => {
		const response = await request(app).get("/nonexistent");
		expect(response.status).toBe(404);
	});
});

describe("livereload middleware", () => {
	it("should apply livereload middleware when provided", async () => {
		let livereloadInvoked = false;
		const { app } = createTestApp({
			livereloadMiddleware: (_req: unknown, _res: unknown, next: () => void) => {
				livereloadInvoked = true;
				next();
			},
		});

		await request(app).get("/");

		expect(livereloadInvoked).toBe(true);
	});
});
