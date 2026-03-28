import { firefoxS3Config, chromeS3Config } from "browser-extension-core/s3-config";
import { JSDOM } from "jsdom";
import request from "supertest";
import { createTestApp } from "../../../test-app";

const TEST_XPI_FILENAME = "abc123-1.0.0.xpi";
const TEST_ZIP_FILENAME = "hutch-chrome-1.0.0.zip";

function mockBothAvailable() {
	jest.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
		const urlStr = url.toString();
		if (urlStr.includes("hutch-extension-prod")) {
			return new Response(TEST_XPI_FILENAME, { status: 200 });
		}
		if (urlStr.includes("hutch-chrome-extension-prod")) {
			return new Response(TEST_ZIP_FILENAME, { status: 200 });
		}
		return new Response("Not Found", { status: 404 });
	});
}

beforeEach(() => {
	mockBothAvailable();
});

afterEach(() => {
	jest.restoreAllMocks();
});

describe("GET /install", () => {
	const { app } = createTestApp();

	it("should return 200 and HTML content", async () => {
		const response = await request(app).get("/install");
		expect(response.status).toBe(200);
		expect(response.headers["content-type"]).toMatch(/text\/html/);
	});

	it("should have page-install body class", async () => {
		const response = await request(app).get("/install");
		const doc = new JSDOM(response.text).window.document;

		expect(doc.body.classList.contains("page-install")).toBe(true);
	});

	it("should default to Chrome tab when no browser param is provided", async () => {
		const response = await request(app).get("/install");
		const doc = new JSDOM(response.text).window.document;

		const chromeTab = doc.querySelector('[data-test-tab="chrome"]');
		expect(chromeTab?.classList.contains("install-page__tab--active")).toBe(true);
		expect(chromeTab?.getAttribute("aria-current")).toBe("page");

		const firefoxTab = doc.querySelector('[data-test-tab="firefox"]');
		expect(firefoxTab?.classList.contains("install-page__tab--active")).toBe(false);
	});

	it("should select Firefox tab when browser=firefox", async () => {
		const response = await request(app).get("/install?browser=firefox");
		const doc = new JSDOM(response.text).window.document;

		const firefoxTab = doc.querySelector('[data-test-tab="firefox"]');
		expect(firefoxTab?.classList.contains("install-page__tab--active")).toBe(true);
		expect(firefoxTab?.getAttribute("aria-current")).toBe("page");

		const chromeTab = doc.querySelector('[data-test-tab="chrome"]');
		expect(chromeTab?.classList.contains("install-page__tab--active")).toBe(false);
	});

	it("should select Chrome tab when browser=chrome", async () => {
		const response = await request(app).get("/install?browser=chrome");
		const doc = new JSDOM(response.text).window.document;

		const chromeTab = doc.querySelector('[data-test-tab="chrome"]');
		expect(chromeTab?.classList.contains("install-page__tab--active")).toBe(true);

		const firefoxTab = doc.querySelector('[data-test-tab="firefox"]');
		expect(firefoxTab?.classList.contains("install-page__tab--active")).toBe(false);
	});

	it("should render Firefox panel content when browser=firefox", async () => {
		const response = await request(app).get("/install?browser=firefox");
		const doc = new JSDOM(response.text).window.document;

		expect(doc.querySelector('[data-test-section="firefox"]')).not.toBeNull();
		expect(doc.querySelector('[data-test-section="chrome"]')).toBeNull();
	});

	it("should render Chrome panel content when browser=chrome", async () => {
		const response = await request(app).get("/install?browser=chrome");
		const doc = new JSDOM(response.text).window.document;

		expect(doc.querySelector('[data-test-section="chrome"]')).not.toBeNull();
		expect(doc.querySelector('[data-test-section="firefox"]')).toBeNull();
	});

	it("should render the Firefox download button linking to the S3 XPI", async () => {
		const response = await request(app).get("/install?browser=firefox");
		const doc = new JSDOM(response.text).window.document;

		const cta = doc.querySelector(
			'[data-test-cta="download-firefox"]',
		);
		expect(cta?.getAttribute("href")).toBe(firefoxS3Config.getExtensionDownloadUrl({ stage: "prod", filename: TEST_XPI_FILENAME }));
	});

	it("should render the Chrome download button linking to the S3 ZIP", async () => {
		const response = await request(app).get("/install?browser=chrome");
		const doc = new JSDOM(response.text).window.document;

		const cta = doc.querySelector(
			'[data-test-cta="download-chrome"]',
		);
		expect(cta?.getAttribute("href")).toBe(chromeS3Config.getExtensionDownloadUrl({ stage: "prod", filename: TEST_ZIP_FILENAME }));
		expect(cta?.textContent).toBe("Download Hutch for Chrome");
	});

	it("should render Firefox installation steps on Firefox tab", async () => {
		const response = await request(app).get("/install?browser=firefox");
		const doc = new JSDOM(response.text).window.document;

		const steps = doc.querySelector('[data-test-section="firefox-steps"]');
		const items = steps?.querySelectorAll("li");
		expect(items?.length).toBe(3);
	});

	it("should render Chrome installation steps on Chrome tab", async () => {
		const response = await request(app).get("/install?browser=chrome");
		const doc = new JSDOM(response.text).window.document;

		const steps = doc.querySelector('[data-test-section="chrome-steps"]');
		const items = steps?.querySelectorAll("li");
		expect(items?.length).toBe(3);
	});

	it("should set appropriate SEO metadata", async () => {
		const response = await request(app).get("/install");
		const doc = new JSDOM(response.text).window.document;

		expect(doc.title).toContain("Install");
		const description = doc.querySelector('meta[name="description"]');
		expect(description?.getAttribute("content")).toContain("extension");
	});

	it("should show Firefox unavailable message when Firefox latest.txt returns 404", async () => {
		jest.restoreAllMocks();
		jest.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
			const urlStr = url.toString();
			if (urlStr.includes("hutch-extension-prod")) {
				return new Response("Not Found", { status: 404 });
			}
			if (urlStr.includes("hutch-chrome-extension-prod")) {
				return new Response(TEST_ZIP_FILENAME, { status: 200 });
			}
			return new Response("Not Found", { status: 404 });
		});

		const response = await request(app).get("/install?browser=firefox");
		const doc = new JSDOM(response.text).window.document;

		expect(doc.querySelector('[data-test-cta="download-firefox"]')).toBeNull();
		const unavailable = doc.querySelector('[data-test-section="firefox-unavailable"]');
		expect(unavailable?.textContent).toBe(
			"The Firefox extension is not available for download yet. Please check back soon.",
		);
	});

	it("should show Chrome unavailable message when Chrome latest.txt returns 404", async () => {
		jest.restoreAllMocks();
		jest.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
			const urlStr = url.toString();
			if (urlStr.includes("hutch-extension-prod")) {
				return new Response(TEST_XPI_FILENAME, { status: 200 });
			}
			if (urlStr.includes("hutch-chrome-extension-prod")) {
				return new Response("Not Found", { status: 404 });
			}
			return new Response("Not Found", { status: 404 });
		});

		const response = await request(app).get("/install?browser=chrome");
		const doc = new JSDOM(response.text).window.document;

		expect(doc.querySelector('[data-test-cta="download-chrome"]')).toBeNull();
		const unavailable = doc.querySelector('[data-test-section="chrome-unavailable"]');
		expect(unavailable?.textContent).toBe(
			"The Chrome extension is not available for download yet. Please check back soon.",
		);
	});

	it("should link tabs to the correct URLs", async () => {
		const response = await request(app).get("/install?browser=firefox");
		const doc = new JSDOM(response.text).window.document;

		const firefoxTab = doc.querySelector('[data-test-tab="firefox"]');
		expect(firefoxTab?.getAttribute("href")).toBe("/install?browser=firefox");

		const chromeTab = doc.querySelector('[data-test-tab="chrome"]');
		expect(chromeTab?.getAttribute("href")).toBe("/install?browser=chrome");
	});
});
