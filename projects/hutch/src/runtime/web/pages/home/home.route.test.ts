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

		const backstory = doc.querySelector('[data-test-section="backstory"]');
		expect(backstory).not.toBeNull();
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

	it("should render the founding members progress bar with zero users", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		const progress = doc.querySelector("[data-test-founding-progress]");
		const label = progress?.querySelector(".founding-progress__label");
		expect(label?.textContent).toBe("0 / 100 founding members");

		const fill = progress?.querySelector(".founding-progress__fill") as HTMLElement;
		expect(fill.getAttribute("style")).toBe("width: 0%");
	});

	it("should not render the exhausted message when under the limit", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		const exhausted = doc.querySelector("[data-test-founding-exhausted]");
		expect(exhausted).toBeNull();
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

describe("GET / with exhausted founding allocation", () => {
	it("should render the exhausted message and cap progress at 100% when users exceed the limit", async () => {
		const { app, auth } = createTestApp();

		for (let i = 0; i < 101; i++) {
			await auth.createUser({ email: `user${i}@test.com`, password: "password123" });
		}

		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		const exhausted = doc.querySelector("[data-test-founding-exhausted]");
		expect(exhausted?.textContent).toBe("The free allocation has exhausted! You might still be able to create an account for free while we develop the pricing system but it may require payment in a few months.");

		const fill = doc.querySelector(".founding-progress__fill") as HTMLElement;
		expect(fill.getAttribute("style")).toBe("width: 100%");

		const label = doc.querySelector(".founding-progress__label");
		expect(label?.textContent).toBe("101 / 100 founding members");
	});
});

describe("GET /nonexistent", () => {
	const { app } = createTestApp();

	it("should return 404", async () => {
		const response = await request(app).get("/nonexistent");
		expect(response.status).toBe(404);
	});
});

