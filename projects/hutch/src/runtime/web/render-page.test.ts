import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { UserIdSchema } from "../domain/user/user.schema";
import type { BannerStateSource } from "./banner-state";
import type { PageBody } from "./page-body.types";
import { renderPage } from "./render-page";

function createTestPageBody(): PageBody {
	return {
		seo: {
			title: "Test Page",
			description: "Test description",
			canonicalUrl: "https://readplace.com/test",
		},
		styles: "",
		content: "<main><p>Test content</p></main>",
	};
}

const USER_ID = UserIdSchema.parse("user-1");

describe("renderPage", () => {
	it("should render guest navigation for an unauthenticated request", () => {
		const req: BannerStateSource = {};
		const result = renderPage(req, createTestPageBody()).to("text/html");
		const doc = new JSDOM(result.body).window.document;

		const nav = doc.querySelector("[data-test-nav-variant]");
		assert(nav, "nav variant must be rendered");
		expect(nav.getAttribute("data-test-nav-variant")).toBe("guest");

		const loginItem = doc.querySelector('[data-test-nav-item="login"]');
		assert(loginItem, "login nav item must be rendered for guests");
	});

	it("should render authenticated navigation for a request with a userId", () => {
		const req: BannerStateSource = { userId: USER_ID, emailVerified: true };
		const result = renderPage(req, createTestPageBody()).to("text/html");
		const doc = new JSDOM(result.body).window.document;

		const nav = doc.querySelector("[data-test-nav-variant]");
		assert(nav, "nav variant must be rendered");
		expect(nav.getAttribute("data-test-nav-variant")).toBe("authenticated");

		const queueItem = doc.querySelector('[data-test-nav-item="queue"]');
		assert(queueItem, "queue nav item must be rendered for authenticated users");

		const logoutItem = doc.querySelector('[data-test-nav-item="logout"]');
		assert(logoutItem, "logout nav item must be rendered for authenticated users");
	});

	it("should show the verification banner for an authenticated, unverified request", () => {
		const req: BannerStateSource = { userId: USER_ID, emailVerified: false };
		const result = renderPage(req, createTestPageBody()).to("text/html");
		const doc = new JSDOM(result.body).window.document;

		const banner = doc.querySelector("[data-test-verify-banner]");
		assert(banner, "verify banner must be rendered");
		expect(banner.classList.contains("verify-banner--visible")).toBe(true);
	});

	it("should hide the verification banner for an authenticated, verified request", () => {
		const req: BannerStateSource = { userId: USER_ID, emailVerified: true };
		const result = renderPage(req, createTestPageBody()).to("text/html");
		const doc = new JSDOM(result.body).window.document;

		const banner = doc.querySelector("[data-test-verify-banner]");
		assert(banner, "verify banner must be rendered");
		expect(banner.classList.contains("verify-banner--hidden")).toBe(true);
	});

	it("should hide the verification banner for a request without an emailVerified flag", () => {
		const req: BannerStateSource = { userId: USER_ID };
		const result = renderPage(req, createTestPageBody()).to("text/html");
		const doc = new JSDOM(result.body).window.document;

		const banner = doc.querySelector("[data-test-verify-banner]");
		assert(banner, "verify banner must be rendered");
		expect(banner.classList.contains("verify-banner--hidden")).toBe(true);
	});

	it("should hide the verification banner for an unauthenticated request", () => {
		const req: BannerStateSource = {};
		const result = renderPage(req, createTestPageBody()).to("text/html");
		const doc = new JSDOM(result.body).window.document;

		const banner = doc.querySelector("[data-test-verify-banner]");
		assert(banner, "verify banner must be rendered");
		expect(banner.classList.contains("verify-banner--hidden")).toBe(true);
	});
});
