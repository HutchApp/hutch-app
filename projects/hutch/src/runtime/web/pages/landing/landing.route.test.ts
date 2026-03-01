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

		const heroTitle = doc.querySelector(".landing-hero__title");
		expect(heroTitle?.textContent).toContain("Save now.");
		expect(heroTitle?.textContent).toContain("Read later.");
		expect(heroTitle?.textContent).toContain("Remember forever.");
	});

	it("should render the primary CTA linking to signup", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		const cta = doc.querySelector('[data-test-cta="start-free"]') as HTMLAnchorElement;
		expect(cta.getAttribute("href")).toBe("/signup");
		expect(cta.textContent).toBe("Start Reading Free");
	});

	it("should render the core features section with six features", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		const coreSection = doc.querySelector('[data-test-section="core-features"]');
		const features = coreSection?.querySelectorAll(".feature-card");
		expect(features?.length).toBe(6);
	});

	it("should render the power features section with six features", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		const powerSection = doc.querySelector('[data-test-section="power-features"]');
		const features = powerSection?.querySelectorAll(".feature-card");
		expect(features?.length).toBe(6);
	});

	it("should render in-development features with grayed-out class and badge", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		const devCards = doc.querySelectorAll(".feature-card--in-development");
		expect(devCards.length).toBe(12);

		const firstBadge = devCards[0].querySelector(".feature-card__badge");
		expect(firstBadge?.textContent).toBe("In Development");
	});

	it("should render three pricing plans", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		expect(doc.querySelector('[data-test-plan="free"] .pricing-card__name')?.textContent).toBe("Free");
		expect(doc.querySelector('[data-test-plan="pro"] .pricing-card__name')?.textContent).toBe("Pro");
		expect(doc.querySelector('[data-test-plan="pro-plus"] .pricing-card__name')?.textContent).toBe("Pro+");
	});

	it("should render the comparison table", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		const table = doc.querySelector("[data-test-comparison-table]");
		const rows = table?.querySelectorAll("tbody tr");
		expect(rows?.length).toBe(7);
	});

	it("should render the trust section with four trust items", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		const trustSection = doc.querySelector('[data-test-section="trust"]');
		const cards = trustSection?.querySelectorAll(".trust-card");
		expect(cards?.length).toBe(4);
	});

	it("should have page-landing body class", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		expect(doc.body.classList.contains("page-landing")).toBe(true);
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
