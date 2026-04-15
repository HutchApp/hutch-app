import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import request from "supertest";
import type { AppConfig } from "./config";
import { createApp } from "./server";

const DEFAULT_CONFIG: AppConfig = {
	port: 3500,
	appOrigin: "https://readplace.com",
	embedOrigin: "http://localhost:3500",
};

function makeApp(overrides: Partial<AppConfig> = {}) {
	return createApp({ ...DEFAULT_CONFIG, ...overrides });
}

describe("GET /", () => {
	it("should return 200 and HTML content", async () => {
		const app = makeApp();
		const response = await request(app).get("/");
		expect(response.status).toBe(200);
		expect(response.headers["content-type"]).toMatch(/text\/html/);
	});

	it("should render the hero title inside the embed page container", async () => {
		const app = makeApp();
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;
		const page = doc.querySelector('[data-test-page="embed"]');
		assert(page, "embed page container must be rendered");
		const title = page.querySelector(".embed-page__title");
		assert(title, "hero title must be rendered");
		expect(title.textContent).toBe("A save button for your readers.");
	});

	it("should render all three variants with numeric byte counts", async () => {
		const app = makeApp();
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		expect(doc.querySelectorAll("[data-test-variant]")).toHaveLength(3);

		for (const id of ["bytes-a", "bytes-b", "bytes-c"] as const) {
			const bytes = doc.querySelector(`[data-test="${id}"]`);
			assert(bytes, `${id} byte count must be rendered`);
			expect(bytes.textContent).toMatch(/^\d+ bytes$/);
		}
	});

	it("should render every variant preview as a live anchor that links into the save flow", async () => {
		const app = makeApp();
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		for (const id of ["preview-a", "preview-b", "preview-c"] as const) {
			const preview = doc.querySelector(`[data-test="${id}"]`);
			assert(preview, `${id} preview container must be rendered`);
			const anchor = preview.querySelector("a");
			assert(anchor, `${id} preview must contain a live anchor`);
			expect(anchor.getAttribute("href")).toContain("/save");
		}
	});

	it("should render every snippet source as escaped text that preserves the canonical URLs", async () => {
		const app = makeApp();
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		for (const id of ["source-a", "source-b", "source-c"] as const) {
			const source = doc.querySelector(`[data-test="${id}"]`);
			assert(source, `${id} source block must be rendered`);
			expect(source.textContent).toContain("<a href=");
			expect(source.textContent).toContain("https://readplace.com/save");
			expect(source.textContent).toContain("https://embed.readplace.com/icon.svg");
		}
	});

	it("should render the hero demo as the unmodified snippet B so it exercises the same Referer-based save flow as publishers get", async () => {
		const app = makeApp();
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;
		const demo = doc.querySelector('[data-test="hero-demo"]');
		assert(demo, "hero demo container must be rendered");
		const anchor = demo.querySelector("a");
		assert(anchor, "hero demo must contain an anchor");
		expect(anchor.getAttribute("href")).toBe("https://readplace.com/save");
	});

	it("should render the quotable privacy statement", async () => {
		const app = makeApp();
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;
		const privacy = doc.querySelector('[data-test="privacy-text"]');
		assert(privacy, "privacy statement must be rendered");
		expect(privacy.textContent).toContain("plain HTML link");
		expect(privacy.textContent).toContain("sets no cookies");
	});

	it("should expose a copy button for every snippet and the privacy paragraph", async () => {
		const app = makeApp();
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;
		expect(doc.querySelectorAll("button[data-copy]")).toHaveLength(4);
	});

	it("should include the copy-to-clipboard inline script", async () => {
		const app = makeApp();
		const response = await request(app).get("/");
		expect(response.text).toContain("navigator.clipboard");
	});

	it("should register / with the default indexable robots directive", async () => {
		const app = makeApp();
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;
		const robots = doc.querySelector('meta[name="robots"]');
		assert(robots, "robots meta must be rendered");
		expect(robots.getAttribute("content")).toBe("index, follow");
	});

	it("should substitute the Readplace app origin in live preview save links when appOrigin differs from the canonical value", async () => {
		const app = makeApp({ appOrigin: "http://127.0.0.1:9999" });
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;
		const previewAnchor = doc.querySelector('[data-test="preview-b"] a');
		assert(previewAnchor, "preview-b anchor must be rendered");
		expect(previewAnchor.getAttribute("href")).toBe("http://127.0.0.1:9999/save");
	});

	it("should substitute the embed origin in live preview icon URLs so the dev server can serve them", async () => {
		const app = makeApp({ embedOrigin: "http://localhost:3700" });
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;
		const previewImg = doc.querySelector('[data-test="preview-a"] img');
		assert(previewImg, "preview-a img must be rendered");
		expect(previewImg.getAttribute("src")).toBe("http://localhost:3700/icon.svg");
	});

	it("should keep the canonical readplace.com and embed.readplace.com URLs inside the copy-paste source blocks regardless of config", async () => {
		const app = makeApp({
			appOrigin: "http://127.0.0.1:9999",
			embedOrigin: "http://localhost:3700",
		});
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;
		const source = doc.querySelector('[data-test="source-b"]');
		assert(source, "source-b must be rendered");
		expect(source.textContent).toContain("https://readplace.com/save");
		expect(source.textContent).toContain("https://embed.readplace.com/icon.svg");
		expect(source.textContent).not.toContain("http://127.0.0.1:9999");
		expect(source.textContent).not.toContain("http://localhost:3700");
	});

	it("should link the footer back to the Readplace app origin", async () => {
		const app = makeApp();
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;
		const link = doc.querySelector('[data-test="link-app"]');
		assert(link, "app link must be rendered");
		expect(link.getAttribute("href")).toBe("https://readplace.com");
	});
});

describe("GET /preview", () => {
	it("should return 200 and HTML content", async () => {
		const app = makeApp();
		const response = await request(app).get("/preview");
		expect(response.status).toBe(200);
		expect(response.headers["content-type"]).toMatch(/text\/html/);
	});

	it("should be marked noindex so search engines skip the developer preview", async () => {
		const app = makeApp();
		const response = await request(app).get("/preview");
		const doc = new JSDOM(response.text).window.document;
		const robots = doc.querySelector('meta[name="robots"]');
		assert(robots, "robots meta must be rendered");
		expect(robots.getAttribute("content")).toBe("noindex, nofollow");
	});

	it("should render one stage per background", async () => {
		const app = makeApp();
		const response = await request(app).get("/preview");
		const doc = new JSDOM(response.text).window.document;
		for (const bg of ["white", "surface", "dark"] as const) {
			const stage = doc.querySelector(`[data-test-bg="${bg}"]`);
			assert(stage, `${bg} stage must be rendered`);
		}
	});

	it("should render each variant once inside every background stage", async () => {
		const app = makeApp();
		const response = await request(app).get("/preview");
		const doc = new JSDOM(response.text).window.document;
		const stages = doc.querySelectorAll(".embed-preview__stage");
		expect(stages).toHaveLength(3);
		for (const stage of Array.from(stages)) {
			expect(stage.querySelectorAll("a")).toHaveLength(3);
		}
	});
});

describe("GET /icon.svg", () => {
	it("should return the embed icon SVG with the correct content type and immutable cache header", async () => {
		const app = makeApp();
		const response = await request(app)
			.get("/icon.svg")
			.buffer(true)
			.parse((res, cb) => {
				let data = "";
				res.setEncoding("utf8");
				res.on("data", (chunk) => {
					data += chunk;
				});
				res.on("end", () => cb(null, data));
			});
		expect(response.status).toBe(200);
		expect(response.headers["content-type"]).toMatch(/image\/svg\+xml/);
		expect(response.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
		expect(response.body).toContain("<svg");
		expect(response.body).toContain('viewBox="0 0 512 512"');
		expect(response.body).toContain("#2B3A55");
		expect(response.body).toContain("#C8923C");
	});
});

describe("GET /health", () => {
	it("should return 200 ok", async () => {
		const app = makeApp();
		const response = await request(app).get("/health");
		expect(response.status).toBe(200);
		expect(response.text).toBe("ok");
	});
});

describe("GET /unknown-path", () => {
	it("should return 404", async () => {
		const app = makeApp();
		const response = await request(app).get("/not-a-real-path");
		expect(response.status).toBe(404);
	});
});
