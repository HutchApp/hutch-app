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
		expect(title?.textContent).toBe("A Pocket alternative that won't shut down");
	});

	it("should render six current feature cards", async () => {
		const response = await request(app).get("/pocket-alternatives");
		const doc = new JSDOM(response.text).window.document;

		const features = doc.querySelectorAll("[data-test-feature]");
		expect(features.length).toBe(6);
	});

	it("should render four planned features", async () => {
		const response = await request(app).get("/pocket-alternatives");
		const doc = new JSDOM(response.text).window.document;

		const planned = doc.querySelectorAll("[data-test-planned]");
		expect(planned.length).toBe(4);
	});

	it("should render the trust section addressing sustainability", async () => {
		const response = await request(app).get("/pocket-alternatives");
		const doc = new JSDOM(response.text).window.document;

		const trust = doc.querySelector('[data-test-section="why-wont-shut-down"]');
		expect(trust).not.toBeNull();
		expect(trust?.textContent).toContain("Even If You Cancel");
	});

	it("should render four migration steps", async () => {
		const response = await request(app).get("/pocket-alternatives");
		const doc = new JSDOM(response.text).window.document;

		const steps = doc.querySelectorAll(".alt-migration__step");
		expect(steps.length).toBe(4);
	});

	it("should render the pricing section with founding member offer", async () => {
		const response = await request(app).get("/pocket-alternatives");
		const doc = new JSDOM(response.text).window.document;

		const pricing = doc.querySelector('[data-test-section="pricing"]');
		expect(pricing?.textContent).toContain("A$0");
		expect(pricing?.textContent).toContain("A$3.99/month");
	});

	it("should set SEO metadata derived from frontmatter", async () => {
		const response = await request(app).get("/pocket-alternatives");
		const doc = new JSDOM(response.text).window.document;

		expect(doc.title).toBe("A Pocket Alternative That Won't Shut Down — Hutch");
		const description = doc.querySelector('meta[name="description"]');
		expect(description?.getAttribute("content")).toContain("Pocket shut down");

		const keywords = doc.querySelector('meta[name="keywords"]');
		expect(keywords?.getAttribute("content")).toContain("pocket alternative");

		const author = doc.querySelector('meta[name="author"]');
		expect(author?.getAttribute("content")).toBe("Fayner Brack");
	});

	it("should include BlogPosting and FAQPage structured data", async () => {
		const response = await request(app).get("/pocket-alternatives");
		const doc = new JSDOM(response.text).window.document;

		const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
		const schemas = Array.from(scripts).map((s) => JSON.parse(s.textContent ?? "{}"));

		const types = schemas.map((s: { "@type": string }) => s["@type"]);
		expect(types).toContain("BlogPosting");
		expect(types).toContain("FAQPage");

		const blogPosting = schemas.find((s: { "@type": string }) => s["@type"] === "BlogPosting");
		expect(blogPosting.headline).toBe("A Pocket Alternative That Won't Shut Down");
		expect(blogPosting.author.name).toBe("Fayner Brack");
		expect(blogPosting.datePublished).toBe("2026-04-06");

		const faq = schemas.find((s: { "@type": string }) => s["@type"] === "FAQPage");
		expect(faq.mainEntity.length).toBe(3);
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

		const features = doc.querySelector('[data-test-section="what-works"]');
		expect(features?.getAttribute("aria-label")).toBe("What works today");

		const migration = doc.querySelector('[data-test-section="how-to-switch"]');
		expect(migration?.getAttribute("aria-label")).toBe("How to switch from Pocket");
	});

	it("should include the page in the sitemap", async () => {
		const response = await request(app).get("/sitemap.xml");
		expect(response.text).toContain("/pocket-alternatives");
	});
});
