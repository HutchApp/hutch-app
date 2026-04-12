import { JSDOM } from "jsdom";
import request from "supertest";
import { createTestApp } from "../../../test-app";
import { getAllPosts } from "./blog.posts";

const firstPost = getAllPosts()[0];

describe("GET /blog", () => {
	const { app } = createTestApp();

	it("should return 200 and HTML content", async () => {
		const response = await request(app).get("/blog");
		expect(response.status).toBe(200);
		expect(response.headers["content-type"]).toMatch(/text\/html/);
	});

	it("should render blog page title", async () => {
		const response = await request(app).get("/blog");
		const doc = new JSDOM(response.text).window.document;

		const title = doc.querySelector(".blog__title");
		expect(title?.textContent).toBe("Open Hutch");
	});

	it("should render links to blog posts", async () => {
		const response = await request(app).get("/blog");
		const doc = new JSDOM(response.text).window.document;

		const link = doc.querySelector(
			`a[href="/blog/${firstPost.slug}"]`,
		);
		expect(link).not.toBeNull();
	});

	it("should render post titles in the listing", async () => {
		const response = await request(app).get("/blog");
		const doc = new JSDOM(response.text).window.document;

		const cardTitles = doc.querySelectorAll(".blog-card__title");
		const texts = Array.from(cardTitles).map((el) => el.textContent);
		expect(texts).toContain(firstPost.title);
	});

	it("should have correct SEO title", async () => {
		const response = await request(app).get("/blog");
		const doc = new JSDOM(response.text).window.document;

		expect(doc.title).toBe("Blog — Hutch");
	});

	it("should have canonical URL", async () => {
		const response = await request(app).get("/blog");
		const doc = new JSDOM(response.text).window.document;

		const canonical = doc.querySelector('link[rel="canonical"]');
		expect(canonical?.getAttribute("href")).toBe(
			"https://readplace.com/blog",
		);
	});

	it("should have the page-blog body class", async () => {
		const response = await request(app).get("/blog");
		const doc = new JSDOM(response.text).window.document;

		expect(doc.body.classList.contains("page-blog")).toBe(true);
	});
});

describe("GET /blog/:slug", () => {
	const { app } = createTestApp();

	it("should return 200 for a valid post slug", async () => {
		const response = await request(app).get(
			`/blog/${firstPost.slug}`,
		);
		expect(response.status).toBe(200);
		expect(response.headers["content-type"]).toMatch(/text\/html/);
	});

	it("should render the post title as h1", async () => {
		const response = await request(app).get(
			`/blog/${firstPost.slug}`,
		);
		const doc = new JSDOM(response.text).window.document;

		const h1 = doc.querySelector(".blog-post__title");
		expect(h1?.textContent).toBe(firstPost.title);
	});

	it("should render the post content as HTML", async () => {
		const response = await request(app).get(
			`/blog/${firstPost.slug}`,
		);
		const doc = new JSDOM(response.text).window.document;

		const content = doc.querySelector(".blog-post__content");
		expect(content?.innerHTML.length).toBeGreaterThan(0);
	});

	it("should render post metadata", async () => {
		const response = await request(app).get(
			`/blog/${firstPost.slug}`,
		);
		const doc = new JSDOM(response.text).window.document;

		const author = doc.querySelector(".blog-post__author");
		expect(author?.textContent).toContain(firstPost.author);

		const date = doc.querySelector(".blog-post__date");
		expect(date?.getAttribute("datetime")).toBe(firstPost.date);
	});

	it("should have og:type set to article", async () => {
		const response = await request(app).get(
			`/blog/${firstPost.slug}`,
		);
		const doc = new JSDOM(response.text).window.document;

		const ogType = doc.querySelector('meta[property="og:type"]');
		expect(ogType?.getAttribute("content")).toBe("article");
	});

	it("should have BlogPosting structured data", async () => {
		const response = await request(app).get(
			`/blog/${firstPost.slug}`,
		);
		const doc = new JSDOM(response.text).window.document;

		const ldJson = doc.querySelector(
			'script[type="application/ld+json"]',
		);
		expect(ldJson).not.toBeNull();
		const data = JSON.parse(ldJson?.textContent ?? "{}");
		expect(data["@type"]).toBe("BlogPosting");
		expect(data.headline).toBe(firstPost.title);
	});

	it("should have correct canonical URL", async () => {
		const response = await request(app).get(
			`/blog/${firstPost.slug}`,
		);
		const doc = new JSDOM(response.text).window.document;

		const canonical = doc.querySelector('link[rel="canonical"]');
		expect(canonical?.getAttribute("href")).toBe(
			`https://readplace.com/blog/${firstPost.slug}`,
		);
	});

	it("should have the page-blog-post body class", async () => {
		const response = await request(app).get(
			`/blog/${firstPost.slug}`,
		);
		const doc = new JSDOM(response.text).window.document;

		expect(doc.body.classList.contains("page-blog-post")).toBe(true);
	});

	it("should return 404 for an unknown slug", async () => {
		const response = await request(app).get("/blog/nonexistent-post");
		expect(response.status).toBe(404);
	});
});

describe("GET /sitemap.xml", () => {
	const { app } = createTestApp();

	it("should include /blog in the sitemap", async () => {
		const response = await request(app).get("/sitemap.xml");
		expect(response.text).toContain("<loc>http://localhost:3000/blog</loc>");
	});

	it("should include blog post URLs in the sitemap", async () => {
		const response = await request(app).get("/sitemap.xml");
		expect(response.text).toContain(
			`<loc>http://localhost:3000/blog/${firstPost.slug}</loc>`,
		);
	});
});
