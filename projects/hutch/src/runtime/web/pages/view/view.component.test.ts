import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import type { Minutes } from "../../../domain/article/article.types";
import { ViewPage, type ViewPageInput } from "./view.component";

const baseInput: ViewPageInput = {
	articleUrl: "https://example.com/post",
	metadata: {
		title: "Hello World",
		siteName: "example.com",
		excerpt: "A lovely article.",
		wordCount: 500,
		imageUrl: "https://cdn.example.com/hero.jpg",
	},
	estimatedReadTime: 3 as Minutes,
	content: "<p>Body copy.</p>",
	summary: "",
	utmParams: [],
};

function render(input = baseInput) {
	const html = ViewPage(input).to("text/html").body;
	return new JSDOM(html).window.document;
}

function requireInput(root: Element, name: string): Element {
	const el = root.querySelector(`input[name="${name}"]`);
	assert(el, `input[name="${name}"] must be rendered`);
	assert.equal(el.tagName, "INPUT", `[name="${name}"] must be an <input>`);
	return el;
}

describe("ViewPage", () => {
	it("renders the article body via the shared renderer", () => {
		const doc = render();

		expect(doc.querySelector("[data-test-reader-title]")?.textContent).toBe(
			"Hello World",
		);
		expect(doc.querySelector("[data-test-reader-site]")?.textContent).toBe(
			"example.com",
		);
		expect(
			doc.querySelector("[data-test-reader-content]")?.innerHTML.trim(),
		).toBe("<p>Body copy.</p>");
	});

	it("marks the back slot as hidden on the view page", () => {
		const doc = render();

		const slot = doc.querySelector("[data-test-back-slot]");
		assert(slot, "back slot must be rendered");
		expect(slot.classList.contains("article-body__back-slot--hidden")).toBe(
			true,
		);
	});

	it("renders the Readplace logo linking to home", () => {
		const doc = render();

		const logo = doc.querySelector("[data-test-view-logo]");
		assert(logo, "logo must be rendered");
		expect(logo.getAttribute("href")).toBe("/");
		expect(logo.textContent).toContain("Readplace");
	});

	it("renders the sticky Save CTA pointing to /save with the article URL", () => {
		const doc = render();

		const form = doc.querySelector("[data-test-view-save]");
		assert(form, "save CTA form must be rendered");
		expect(form.getAttribute("action")).toBe("/save");
		expect(form.getAttribute("method")?.toLowerCase()).toBe("get");
		expect(requireInput(form, "url").getAttribute("value")).toBe(
			"https://example.com/post",
		);
	});

	it("includes utm_* hidden inputs on the Save CTA form", () => {
		const doc = render({
			...baseInput,
			utmParams: [
				["utm_source", "medium"],
				["utm_campaign", "spring"],
			],
		});

		const form = doc.querySelector("[data-test-view-save]");
		assert(form, "save CTA form must be rendered");
		expect(requireInput(form, "utm_source").getAttribute("value")).toBe(
			"medium",
		);
		expect(requireInput(form, "utm_campaign").getAttribute("value")).toBe(
			"spring",
		);
	});

	it("does not include utm inputs when none are provided", () => {
		const doc = render();

		const form = doc.querySelector("[data-test-view-save]");
		assert(form, "save CTA form must be rendered");
		expect(form.querySelectorAll('input[type="hidden"]').length).toBe(1);
	});

	it("emits OG metadata using the article title and excerpt", () => {
		const doc = render();

		expect(
			doc.querySelector('meta[property="og:title"]')?.getAttribute("content"),
		).toBe("Hello World Summary | Readplace");
		expect(
			doc
				.querySelector('meta[property="og:description"]')
				?.getAttribute("content"),
		).toBe("A lovely article.");
		expect(
			doc.querySelector('meta[property="og:image"]')?.getAttribute("content"),
		).toBe("https://cdn.example.com/hero.jpg");
		expect(
			doc.querySelector('meta[property="og:type"]')?.getAttribute("content"),
		).toBe("article");
		expect(
			doc.querySelector('link[rel="canonical"]')?.getAttribute("href"),
		).toBe("https://example.com/post");
	});

	it("falls back to the Readplace default images when article has no imageUrl", () => {
		const { imageUrl: _unused, ...metadataNoImage } = baseInput.metadata;
		const doc = render({ ...baseInput, metadata: metadataNoImage });

		const ogImage = doc
			.querySelector('meta[property="og:image"]')
			?.getAttribute("content");
		const twitterImage = doc
			.querySelector('meta[name="twitter:image"]')
			?.getAttribute("content");
		expect(ogImage).toMatch(/og-image-1200x630\.png$/);
		expect(twitterImage).toMatch(/twitter-card-1200x600\.png$/);
	});

	it("falls back to 'View on Readplace.' description when excerpt is empty", () => {
		const doc = render({
			...baseInput,
			metadata: { ...baseInput.metadata, excerpt: "" },
		});

		expect(
			doc
				.querySelector('meta[property="og:description"]')
				?.getAttribute("content"),
		).toBe("View on Readplace.");
	});

	it("emits index,follow robots meta", () => {
		const doc = render();

		expect(
			doc.querySelector('meta[name="robots"]')?.getAttribute("content"),
		).toBe("index, follow");
	});

	it("emits JSON-LD Article with isBasedOn attributed to the source URL", () => {
		const doc = render();

		const script = doc.querySelector('script[type="application/ld+json"]');
		assert(script, "JSON-LD script must be rendered");
		const data = JSON.parse(script.textContent ?? "{}");
		expect(data["@type"]).toBe("Article");
		expect(data.headline).toBe("Hello World");
		expect(data.isBasedOn).toEqual({
			"@type": "Article",
			url: "https://example.com/post",
		});
		expect(data.image).toBe("https://cdn.example.com/hero.jpg");
	});

	it("omits JSON-LD image when article has no imageUrl", () => {
		const { imageUrl: _unused, ...metadataNoImage } = baseInput.metadata;
		const doc = render({ ...baseInput, metadata: metadataNoImage });

		const script = doc.querySelector('script[type="application/ld+json"]');
		assert(script, "JSON-LD script must be rendered");
		const data = JSON.parse(script.textContent ?? "{}");
		expect(data.image).toBeUndefined();
	});

	it("toggles the summary slot visibility based on summary presence", () => {
		const without = render();
		const slotWithout = without.querySelector("[data-test-reader-summary]");
		assert(slotWithout, "summary slot must be rendered");
		expect(
			slotWithout.classList.contains("article-body__summary-slot--hidden"),
		).toBe(true);

		const withSummary = render({ ...baseInput, summary: "Key points." });
		const slotWith = withSummary.querySelector("[data-test-reader-summary]");
		assert(slotWith, "summary slot must be rendered");
		expect(
			slotWith.classList.contains("article-body__summary-slot--visible"),
		).toBe(true);
	});

	it("renders the no-content fallback while still showing the Save CTA when content is undefined", () => {
		const doc = render({ ...baseInput, content: undefined });

		const fallback = doc.querySelector("[data-test-no-content]");
		assert(fallback, "no-content fallback must be rendered");
		const form = doc.querySelector("[data-test-view-save]");
		assert(form, "save CTA must still be rendered without content");
	});
});
