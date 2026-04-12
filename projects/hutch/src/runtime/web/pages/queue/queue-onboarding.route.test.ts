import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import request from "supertest";
import { COOKIE_NAME, COOKIE_VALUE } from "@packages/onboarding-extension-signal";
import { createTestApp } from "../../../test-app";

async function loginAgent(app: ReturnType<typeof createTestApp>["app"], auth: ReturnType<typeof createTestApp>["auth"]) {
	await auth.createUser({ email: "test@example.com", password: "password123" });
	const agent = request.agent(app);
	await agent
		.post("/login")
		.type("form")
		.send({ email: "test@example.com", password: "password123" });
	return agent;
}

describe("Queue onboarding", () => {
	it("shows onboarding visible with both steps incomplete on empty queue", async () => {
		const { app, auth } = createTestApp();
		const agent = await loginAgent(app, auth);

		const response = await agent.get("/queue");

		const doc = new JSDOM(response.text).window.document;
		const onboarding = doc.querySelector("[data-test-onboarding]");
		assert(onboarding, "onboarding container must be rendered");
		expect(onboarding.classList.contains("onboarding--visible")).toBe(true);

		const installStep = doc.querySelector('[data-test-onboarding-step="install-extension"]');
		assert(installStep, "install-extension step must be rendered");
		expect(installStep.getAttribute("data-test-onboarding-complete")).toBe("false");

		const saveFirstStep = doc.querySelector('[data-test-onboarding-step="save-first-article"]');
		assert(saveFirstStep, "save-first-article step must be rendered");
		expect(saveFirstStep.getAttribute("data-test-onboarding-complete")).toBe("false");
	});

	it("keeps onboarding visible after saving an article when extension cookie is absent", async () => {
		const { app, auth } = createTestApp();
		const agent = await loginAgent(app, auth);

		await agent
			.post("/queue/save")
			.type("form")
			.send({ url: "https://example.com/article" });

		const response = await agent.get("/queue");
		const doc = new JSDOM(response.text).window.document;
		const onboarding = doc.querySelector("[data-test-onboarding]");
		assert(onboarding, "onboarding container must be rendered");
		expect(onboarding.classList.contains("onboarding--visible")).toBe(true);

		const installStep = doc.querySelector('[data-test-onboarding-step="install-extension"]');
		assert(installStep);
		expect(installStep.getAttribute("data-test-onboarding-complete")).toBe("false");

		const saveStep = doc.querySelector('[data-test-onboarding-step="save-first-article"]');
		assert(saveStep);
		expect(saveStep.getAttribute("data-test-onboarding-complete")).toBe("true");
	});

	it("marks install-extension complete when extension cookie is present", async () => {
		const { app, auth } = createTestApp();
		const agent = await loginAgent(app, auth);

		const response = await agent
			.get("/queue")
			.set("Cookie", `${COOKIE_NAME}=${COOKIE_VALUE}`);

		const doc = new JSDOM(response.text).window.document;
		const step = doc.querySelector('[data-test-onboarding-step="install-extension"]');
		assert(step, "install-extension step must be rendered");
		expect(step.getAttribute("data-test-onboarding-complete")).toBe("true");
	});

	it("hides onboarding when both extension cookie and saved article are present", async () => {
		const { app, auth } = createTestApp();
		const agent = await loginAgent(app, auth);

		await agent
			.post("/queue/save")
			.type("form")
			.send({ url: "https://example.com/article" });

		const response = await agent
			.get("/queue")
			.set("Cookie", `${COOKIE_NAME}=${COOKIE_VALUE}`);

		const doc = new JSDOM(response.text).window.document;
		const onboarding = doc.querySelector("[data-test-onboarding]");
		assert(onboarding, "onboarding container must be rendered");
		expect(onboarding.classList.contains("onboarding--hidden")).toBe(true);
		expect(onboarding.classList.contains("onboarding--visible")).toBe(false);
	});

	it("shows 'Install the Chrome browser extension' for Chrome user-agent", async () => {
		const { app, auth } = createTestApp();
		const agent = await loginAgent(app, auth);

		const response = await agent
			.get("/queue")
			.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36");

		const doc = new JSDOM(response.text).window.document;
		const title = doc.querySelector('[data-test-onboarding-step="install-extension"] .onboarding__step-title');
		assert(title);
		expect(title.textContent).toBe("Install the Chrome browser extension");
	});

	it("shows 'Install the Firefox browser extension' for Firefox user-agent", async () => {
		const { app, auth } = createTestApp();
		const agent = await loginAgent(app, auth);

		const response = await agent
			.get("/queue")
			.set("User-Agent", "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0");

		const doc = new JSDOM(response.text).window.document;
		const title = doc.querySelector('[data-test-onboarding-step="install-extension"] .onboarding__step-title');
		assert(title);
		expect(title.textContent).toBe("Install the Firefox browser extension");
	});

	it("shows 'Install a browser extension' for unrecognised user-agent", async () => {
		const { app, auth } = createTestApp();
		const agent = await loginAgent(app, auth);

		const response = await agent
			.get("/queue")
			.set("User-Agent", "curl/8.0");

		const doc = new JSDOM(response.text).window.document;
		const title = doc.querySelector('[data-test-onboarding-step="install-extension"] .onboarding__step-title');
		assert(title);
		expect(title.textContent).toBe("Install a browser extension");
	});

	it("marks save-first-article complete even when viewing an empty filter tab", async () => {
		const { app, auth } = createTestApp();
		const agent = await loginAgent(app, auth);

		await agent
			.post("/queue/save")
			.type("form")
			.send({ url: "https://example.com/article-on-unread-tab" });

		const response = await agent
			.get("/queue?status=read")
			.set("Cookie", `${COOKIE_NAME}=${COOKIE_VALUE}`);

		const doc = new JSDOM(response.text).window.document;
		const onboarding = doc.querySelector("[data-test-onboarding]");
		assert(onboarding, "onboarding container must still be rendered");
		expect(onboarding.classList.contains("onboarding--hidden")).toBe(true);

		const saveFirstStep = onboarding.querySelector('[data-test-onboarding-step="save-first-article"]');
		assert(saveFirstStep, "save-first-article step must be rendered");
		expect(saveFirstStep.getAttribute("data-test-onboarding-complete")).toBe("true");
	});
});
