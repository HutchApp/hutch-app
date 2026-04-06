import { JSDOM } from "jsdom";
import request from "supertest";
import { createTestApp } from "../../../test-app";

describe("GET /pocket-alternatives", () => {
	const { app } = createTestApp();

	it("should return 200 and HTML content", async () => {
		const response = await request(app).get("/pocket-alternatives");
		expect(response.status).toBe(200);
		expect(response.headers["content-type"]).toMatch(/text\/html/);
	});

	it("should render the hero with the page title", async () => {
		const response = await request(app).get("/pocket-alternatives");
		const doc = new JSDOM(response.text).window.document;

		const title = doc.querySelector(".alt-hero__title");
		expect(title?.textContent).toBe("7 Best Pocket Alternatives in 2026");
	});

	it("should render seven alternative cards", async () => {
		const response = await request(app).get("/pocket-alternatives");
		const doc = new JSDOM(response.text).window.document;

		const cards = doc.querySelectorAll("[data-test-alternative]");
		expect(cards.length).toBe(7);
	});

	it("should render Hutch as the first alternative with a featured badge", async () => {
		const response = await request(app).get("/pocket-alternatives");
		const doc = new JSDOM(response.text).window.document;

		const hutchCard = doc.querySelector('[data-test-alternative="Hutch"]');
		expect(hutchCard?.classList.contains("alt-card--hutch")).toBe(true);

		const badge = hutchCard?.querySelector(".alt-card__badge");
		expect(badge?.textContent).toBe("Built by the author of this page");
	});

	it("should render the comparison table with six app columns", async () => {
		const response = await request(app).get("/pocket-alternatives");
		const doc = new JSDOM(response.text).window.document;

		const colHeaders = doc.querySelectorAll("[data-test-comparison-table] thead th[scope=\"col\"]");
		expect(colHeaders.length).toBe(7);
	});

	it("should set SEO metadata for the article", async () => {
		const response = await request(app).get("/pocket-alternatives");
		const doc = new JSDOM(response.text).window.document;

		expect(doc.title).toContain("Pocket Alternatives");
		const description = doc.querySelector('meta[name="description"]');
		expect(description?.getAttribute("content")).toContain("read-it-later");

		const keywords = doc.querySelector('meta[name="keywords"]');
		expect(keywords?.getAttribute("content")).toContain("Pocket alternatives");
	});

	it("should include Article and ItemList structured data", async () => {
		const response = await request(app).get("/pocket-alternatives");
		const doc = new JSDOM(response.text).window.document;

		const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
		const schemas = Array.from(scripts).map((s) => JSON.parse(s.textContent ?? "{}"));

		const types = schemas.map((s: { "@type": string }) => s["@type"]);
		expect(types).toContain("Article");
		expect(types).toContain("ItemList");

		const itemList = schemas.find((s: { "@type": string }) => s["@type"] === "ItemList");
		expect(itemList.numberOfItems).toBe(7);
	});

	it("should have page-pocket-alternatives body class", async () => {
		const response = await request(app).get("/pocket-alternatives");
		const doc = new JSDOM(response.text).window.document;

		expect(doc.body.classList.contains("page-pocket-alternatives")).toBe(true);
	});

	it("should render section landmarks with aria-labels", async () => {
		const response = await request(app).get("/pocket-alternatives");
		const doc = new JSDOM(response.text).window.document;

		const hero = doc.querySelector('[data-test-section="hero"]');
		expect(hero?.getAttribute("aria-label")).toBe("Introduction");

		const alternatives = doc.querySelector('[data-test-section="alternatives"]');
		expect(alternatives?.getAttribute("aria-label")).toBe("Pocket alternatives");
	});

	it("should include the page in the sitemap", async () => {
		const response = await request(app).get("/sitemap.xml");
		expect(response.text).toContain("/pocket-alternatives");
	});
});
