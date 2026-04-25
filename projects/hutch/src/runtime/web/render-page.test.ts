import assert from "node:assert/strict";
import type { Request } from "express";
import { JSDOM } from "jsdom";
import { UserIdSchema } from "../domain/user/user.schema";
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

function createRequest(overrides: Partial<Request> = {}): Request {
	return overrides as Request;
}

describe("renderPage", () => {
	it("should render guest navigation for an unauthenticated request", () => {
		const result = renderPage(createRequest(), createTestPageBody()).to("text/html");
		const doc = new JSDOM(result.body).window.document;

		expect(doc.querySelector('[data-test-nav-item="login"]')).not.toBeNull();
		expect(doc.querySelector('[data-test-nav-item="queue"]')).toBeNull();
	});

	it("should render authenticated navigation for a request with a userId", () => {
		const result = renderPage(
			createRequest({ userId: USER_ID, emailVerified: true }),
			createTestPageBody(),
		).to("text/html");
		const doc = new JSDOM(result.body).window.document;

		expect(doc.querySelector('[data-test-nav-item="queue"]')).not.toBeNull();
		expect(doc.querySelector('[data-test-nav-item="logout"]')).not.toBeNull();
	});

	it("should show the verification banner for an authenticated, unverified request", () => {
		const result = renderPage(
			createRequest({ userId: USER_ID, emailVerified: false }),
			createTestPageBody(),
		).to("text/html");
		const doc = new JSDOM(result.body).window.document;

		const banner = doc.querySelector("[data-test-verify-banner]");
		assert(banner, "verify banner must be rendered");
		expect(banner.classList.contains("verify-banner--visible")).toBe(true);
	});

	it("should hide the verification banner for an authenticated, verified request", () => {
		const result = renderPage(
			createRequest({ userId: USER_ID, emailVerified: true }),
			createTestPageBody(),
		).to("text/html");
		const doc = new JSDOM(result.body).window.document;

		const banner = doc.querySelector("[data-test-verify-banner]");
		assert(banner, "verify banner must be rendered");
		expect(banner.classList.contains("verify-banner--hidden")).toBe(true);
	});

	it("should hide the verification banner for a request without an emailVerified flag", () => {
		const result = renderPage(
			createRequest({ userId: USER_ID }),
			createTestPageBody(),
		).to("text/html");
		const doc = new JSDOM(result.body).window.document;

		const banner = doc.querySelector("[data-test-verify-banner]");
		assert(banner, "verify banner must be rendered");
		expect(banner.classList.contains("verify-banner--hidden")).toBe(true);
	});

	it("should hide the verification banner for an unauthenticated request", () => {
		const result = renderPage(createRequest(), createTestPageBody()).to("text/html");
		const doc = new JSDOM(result.body).window.document;

		const banner = doc.querySelector("[data-test-verify-banner]");
		assert(banner, "verify banner must be rendered");
		expect(banner.classList.contains("verify-banner--hidden")).toBe(true);
	});
});
