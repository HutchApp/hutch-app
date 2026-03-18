import { getExtensionDownloadUrl } from "firefox-extension/s3-config";
import { JSDOM } from "jsdom";
import request from "supertest";
import { createTestApp } from "@packages/hutch-test-app";

const TEST_XPI_FILENAME = "abc123-1.0.0.xpi";

beforeEach(() => {
	jest.spyOn(globalThis, "fetch").mockResolvedValue(
		new Response(TEST_XPI_FILENAME, { status: 200 }),
	);
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

	it("should render the download button linking to the S3 XPI", async () => {
		const response = await request(app).get("/install");
		const doc = new JSDOM(response.text).window.document;

		const cta = doc.querySelector(
			'[data-test-cta="download-extension"]',
		) as HTMLAnchorElement;
		expect(cta.getAttribute("href")).toBe(getExtensionDownloadUrl({ stage: "prod", xpiFilename: TEST_XPI_FILENAME }));
		expect(cta.textContent).toBe("Download Hutch for Firefox (test mode)");
	});

	it("should render installation steps", async () => {
		const response = await request(app).get("/install");
		const doc = new JSDOM(response.text).window.document;

		const steps = doc.querySelector('[data-test-section="install-steps"]');
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

	it("should show unavailable message when latest.txt returns 404", async () => {
		jest.restoreAllMocks();
		jest.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("Not Found", { status: 404 }),
		);

		const response = await request(app).get("/install");
		const doc = new JSDOM(response.text).window.document;

		expect(doc.querySelector('[data-test-cta="download-extension"]')).toBeNull();
		const unavailable = doc.querySelector('[data-test-section="download-unavailable"]');
		expect(unavailable?.textContent).toBe(
			"The extension is not available for download yet. Please check back soon.",
		);
	});
});
