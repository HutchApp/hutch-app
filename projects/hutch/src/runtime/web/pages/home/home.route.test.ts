import { JSDOM } from "jsdom";
import request from "supertest";
import { createTestApp } from "@packages/hutch-test-app";

async function loginAgent(app: ReturnType<typeof createTestApp>["app"], auth: ReturnType<typeof createTestApp>["auth"]) {
	await auth.createUser({ email: "voter@example.com", password: "password123" });
	const agent = request.agent(app);
	await agent
		.post("/login")
		.type("form")
		.send({ email: "voter@example.com", password: "password123" });
	return agent;
}

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

		const heroTitle = doc.querySelector(".home-hero__title");
		expect(heroTitle?.textContent).toBe("You are what you read.");
	});

	it("should render the primary CTA linking to Firefox install", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		const cta = doc.querySelector('[data-test-cta="install-firefox"]') as HTMLAnchorElement;
		expect(cta.getAttribute("href")).toBe("/install");
		expect(cta.textContent).toBe("Install for Firefox");
	});

	it("should render the secondary CTA linking to GitHub", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		const cta = doc.querySelector('[data-test-cta="view-github"]') as HTMLAnchorElement;
		expect(cta.getAttribute("href")).toBe("https://github.com/HutchApp/hutch-app");
		expect(cta.textContent).toBe("View on GitHub");
	});

	it("should render the core features section with shipped features only", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		const coreSection = doc.querySelector('[data-test-section="core-features"]');
		const features = coreSection?.querySelectorAll(".feature-card");
		expect(features?.length).toBe(9);
	});

	it("should render three demo videos: Desktop, Firefox Extension, and Chrome Extension", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		const demoSection = doc.querySelector('[data-test-section="demo"]');
		const videoLabels = demoSection?.querySelectorAll(".home-demo__video-label");
		const labels = Array.from(videoLabels ?? []).map((el) => el.textContent);
		expect(labels).toEqual(["Desktop", "Firefox Extension", "Chrome Extension"]);
	});

	it("should render the backstory section", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		const backstory = doc.querySelector('[data-test-section="backstory"]');
		expect(backstory).not.toBeNull();
	});

	it("should render one pricing plan for founding members", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		const pricingSection = doc.querySelector('[data-test-section="pricing"]');
		const plans = pricingSection?.querySelectorAll(".pricing-card");
		expect(plans?.length).toBe(1);
		expect(doc.querySelector('[data-test-plan="founding"] .pricing-card__name')?.textContent).toBe("Founding Member");
		expect(doc.querySelector('[data-test-plan="founding"] .pricing-card__price')?.textContent).toContain("A$0");
	});

	it("should render the founding members progress bar with zero users", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		const progress = doc.querySelector("[data-test-founding-progress]");
		const label = progress?.querySelector(".founding-progress__label");
		expect(label?.textContent).toBe("0 / 100 founding members");

		const fill = progress?.querySelector(".founding-progress__fill") as HTMLElement;
		expect(fill.getAttribute("style")).toBe("width: 0%");
	});

	it("should not render the exhausted message when under the limit", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		const exhausted = doc.querySelector("[data-test-founding-exhausted]");
		expect(exhausted).toBeNull();
	});

	it("should render the comparison table", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		const table = doc.querySelector("[data-test-comparison-table]");
		const rows = table?.querySelectorAll("tbody tr");
		expect(rows?.length).toBe(3);
	});

	it("should render the trust section with two trust items", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		const trustSection = doc.querySelector('[data-test-section="trust"]');
		const cards = trustSection?.querySelectorAll(".trust-card");
		expect(cards?.length).toBe(1);
	});


	it("should have page-home body class", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		expect(doc.body.classList.contains("page-home")).toBe(true);
	});

	it("should set appropriate SEO metadata", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		expect(doc.title).toContain("Hutch");
		expect(doc.title).toContain("You are what you read");
		const description = doc.querySelector('meta[name="description"]');
		expect(description?.getAttribute("content")).toContain("read-it-later");
	});

	it("should include author and keywords meta tags", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		const author = doc.querySelector('meta[name="author"]');
		expect(author?.getAttribute("content")).toBe("Fayner Brack");

		const keywords = doc.querySelector('meta[name="keywords"]');
		expect(keywords?.getAttribute("content")).toContain("Pocket alternative");
	});

	it("should include Open Graph image alt text", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		const ogImageAlt = doc.querySelector('meta[property="og:image:alt"]');
		expect(ogImageAlt?.getAttribute("content")).toContain("Hutch");
	});

	it("should not include twitter:site when no handle is configured", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		const twitterSite = doc.querySelector('meta[name="twitter:site"]');
		expect(twitterSite).toBeNull();
	});

	it("should include multiple structured data schemas", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
		const schemas = Array.from(scripts).map((s) => JSON.parse(s.textContent ?? "{}"));

		const types = schemas.map((s: { "@type": string }) => s["@type"]);
		expect(types).toEqual(["WebApplication", "Organization", "FAQPage"]);
	});

	it("should include FAQ structured data with questions and answers", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
		const schemas = Array.from(scripts).map((s) => JSON.parse(s.textContent ?? "{}"));
		const faq = schemas.find((s: { "@type": string }) => s["@type"] === "FAQPage");

		expect(faq.mainEntity.length).toBe(4);
		expect(faq.mainEntity[0].name).toBe("What is Hutch?");
	});

	it("should render section landmarks with aria-labels", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		const hero = doc.querySelector('[data-test-section="hero"]');
		expect(hero?.getAttribute("aria-label")).toBe("Introduction");

		const pricing = doc.querySelector('[data-test-section="pricing"]');
		expect(pricing?.getAttribute("aria-label")).toBe("Pricing");
	});

	it("should use scope attributes on comparison table headers", async () => {
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		const colHeaders = doc.querySelectorAll('[data-test-comparison-table] thead th[scope="col"]');
		expect(colHeaders.length).toBe(5);

		const rowHeaders = doc.querySelectorAll('[data-test-comparison-table] tbody th[scope="row"]');
		expect(rowHeaders.length).toBe(3);
	});
});

describe("GET / with exhausted founding allocation", () => {
	it("should render the exhausted message and cap progress at 100% when users exceed the limit", async () => {
		const { app, auth } = createTestApp();

		for (let i = 0; i < 101; i++) {
			await auth.createUser({ email: `user${i}@test.com`, password: "password123" });
		}

		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		const exhausted = doc.querySelector("[data-test-founding-exhausted]");
		expect(exhausted?.textContent).toBe("The free allocation has been exhausted. You might still be able to create an account for free while I develop the pricing system but it may require payment in a few months.");

		const fill = doc.querySelector(".founding-progress__fill") as HTMLElement;
		expect(fill.getAttribute("style")).toBe("width: 100%");

		const label = doc.querySelector(".founding-progress__label");
		expect(label?.textContent).toBe("101 / 100 founding members");
	});
});

describe("GET / roadmap voting (unauthenticated)", () => {
	it("should show login link instead of vote buttons", async () => {
		const { app } = createTestApp();
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		const roadmap = doc.querySelector('[data-test-section="roadmap"]');
		const subtitle = roadmap?.querySelector(".section-header__subtitle");
		expect(subtitle?.textContent).toContain("Log in");

		const voteButtons = roadmap?.querySelectorAll(".vote-btn");
		expect(voteButtons?.length).toBe(0);
	});

	it("should show vote counts even when not logged in", async () => {
		const { app } = createTestApp();
		const response = await request(app).get("/");
		const doc = new JSDOM(response.text).window.document;

		const voteCounts = doc.querySelectorAll(".feature-card__vote-count");
		expect(voteCounts.length).toBe(7);
		expect(voteCounts[0].textContent).toBe("0 votes");
	});
});

describe("GET / roadmap voting (authenticated)", () => {
	it("should show vote buttons for planned features", async () => {
		const { app, auth } = createTestApp();
		const agent = await loginAgent(app, auth);

		const response = await agent.get("/");
		const doc = new JSDOM(response.text).window.document;

		const roadmap = doc.querySelector('[data-test-section="roadmap"]');
		const voteButtons = roadmap?.querySelectorAll(".vote-btn");
		expect(voteButtons?.length).toBe(7);
	});

	it("should show 'Vote' text on unvoted features", async () => {
		const { app, auth } = createTestApp();
		const agent = await loginAgent(app, auth);

		const response = await agent.get("/");
		const doc = new JSDOM(response.text).window.document;

		const voteBtn = doc.querySelector('[data-test-vote="email-link-import"]');
		expect(voteBtn?.textContent?.trim()).toContain("Vote");
	});
});

describe("POST /vote", () => {
	it("should redirect to login when not authenticated", async () => {
		const { app } = createTestApp();
		const response = await request(app)
			.post("/vote")
			.type("form")
			.send({ featureId: "email-link-import" });

		expect(response.status).toBe(303);
		expect(response.headers.location).toBe("/login");
	});

	it("should cast a vote and redirect to roadmap", async () => {
		const { app, auth } = createTestApp();
		const agent = await loginAgent(app, auth);

		const voteResponse = await agent
			.post("/vote")
			.type("form")
			.send({ featureId: "email-link-import" });

		expect(voteResponse.status).toBe(303);
		expect(voteResponse.headers.location).toBe("/#roadmap");

		const homeResponse = await agent.get("/");
		const doc = new JSDOM(homeResponse.text).window.document;
		const voteCount = doc.querySelector('[data-test-vote-count="email-link-import"]');
		expect(voteCount?.textContent).toBe("1 vote");
	});

	it("should toggle vote off when voting again on the same feature", async () => {
		const { app, auth } = createTestApp();
		const agent = await loginAgent(app, auth);

		await agent.post("/vote").type("form").send({ featureId: "email-link-import" });
		await agent.post("/vote").type("form").send({ featureId: "email-link-import" });

		const homeResponse = await agent.get("/");
		const doc = new JSDOM(homeResponse.text).window.document;
		const voteCount = doc.querySelector('[data-test-vote-count="email-link-import"]');
		expect(voteCount?.textContent).toBe("0 votes");
	});

	it("should show voted state after casting a vote", async () => {
		const { app, auth } = createTestApp();
		const agent = await loginAgent(app, auth);

		await agent.post("/vote").type("form").send({ featureId: "highlights-notes" });

		const homeResponse = await agent.get("/");
		const doc = new JSDOM(homeResponse.text).window.document;
		const voteBtn = doc.querySelector('[data-test-vote="highlights-notes"]');
		expect(voteBtn?.classList.contains("vote-btn--voted")).toBe(true);
		expect(voteBtn?.textContent?.trim()).toContain("Voted");
	});

	it("should redirect to roadmap when featureId is missing", async () => {
		const { app, auth } = createTestApp();
		const agent = await loginAgent(app, auth);

		const response = await agent.post("/vote").type("form").send({});
		expect(response.status).toBe(303);
		expect(response.headers.location).toBe("/#roadmap");
	});
});

describe("GET /robots.txt", () => {
	const { app } = createTestApp();

	it("should return a text response with crawl directives", async () => {
		const response = await request(app).get("/robots.txt");
		expect(response.status).toBe(200);
		expect(response.headers["content-type"]).toMatch(/text\/plain/);
		expect(response.text).toContain("User-agent: *");
		expect(response.text).toContain("Allow: /");
		expect(response.text).toContain("Disallow: /queue");
		expect(response.text).toContain("Sitemap:");
	});
});

describe("GET /sitemap.xml", () => {
	const { app } = createTestApp();

	it("should return an XML sitemap with exactly the public pages", async () => {
		const response = await request(app).get("/sitemap.xml");
		expect(response.status).toBe(200);
		expect(response.headers["content-type"]).toMatch(/application\/xml/);

		const urls = Array.from(response.text.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1]);
		expect(urls).toEqual([
			"http://localhost:3000/",
			"http://localhost:3000/install",
			"http://localhost:3000/login",
			"http://localhost:3000/signup",
			"http://localhost:3000/privacy",
			"http://localhost:3000/terms",
		]);
	});
});

describe("GET /nonexistent", () => {
	const { app } = createTestApp();

	it("should return 404", async () => {
		const response = await request(app).get("/nonexistent");
		expect(response.status).toBe(404);
	});
});

