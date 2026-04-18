import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import type { Minutes } from "../../../domain/article/article.types";
import { renderArticleBody } from "./article-body";

const baseInput = {
	title: "Hello World",
	siteName: "example.com",
	estimatedReadTime: 3 as Minutes,
	url: "https://example.com/post",
};

function parse(html: string) {
	return new JSDOM(`<!doctype html><html><body>${html}</body></html>`).window
		.document;
}

describe("renderArticleBody", () => {
	it("renders the article title, site name, reading time and content", () => {
		const html = renderArticleBody({
			...baseInput,
			content: "<p>Body copy</p>",
		});
		const doc = parse(html);

		expect(doc.querySelector("[data-test-reader-title]")?.textContent).toBe(
			"Hello World",
		);
		expect(doc.querySelector("[data-test-reader-site]")?.textContent).toBe(
			"example.com",
		);
		expect(doc.querySelector(".article-body__meta")?.textContent).toContain(
			"3 min read",
		);
		expect(
			doc.querySelector("[data-test-reader-content]")?.innerHTML.trim(),
		).toBe("<p>Body copy</p>");
	});

	it("marks the summary slot as visible when summary is a non-empty string", () => {
		const html = renderArticleBody({
			...baseInput,
			content: "<p>Body</p>",
			summary: "Key points.",
		});
		const doc = parse(html);

		const slot = doc.querySelector("[data-test-reader-summary]");
		assert(slot, "summary slot must be rendered");
		expect(
			slot.classList.contains("article-body__summary-slot--visible"),
		).toBe(true);
		expect(doc.querySelector(".article-body__summary-toggle")?.textContent).toBe(
			"Summary (TL;DR)",
		);
		expect(doc.querySelector(".article-body__summary-text")?.textContent).toBe(
			"Key points.",
		);
	});

	it("renders the summary collapsed by default", () => {
		const html = renderArticleBody({
			...baseInput,
			content: "<p>Body</p>",
			summary: "Key points.",
		});
		const doc = parse(html);

		const details = doc.querySelector(".article-body__summary");
		assert(details, "summary details element must be rendered");
		expect(details.hasAttribute("open")).toBe(false);
	});

	it("renders the summary expanded when summaryOpen is true", () => {
		const html = renderArticleBody({
			...baseInput,
			content: "<p>Body</p>",
			summary: "Key points.",
			summaryOpen: true,
		});
		const doc = parse(html);

		const details = doc.querySelector(".article-body__summary");
		assert(details, "summary details element must be rendered");
		expect(details.hasAttribute("open")).toBe(true);
	});

	it("marks the summary slot as hidden when summary is empty", () => {
		const html = renderArticleBody({
			...baseInput,
			content: "<p>Body</p>",
			summary: "",
		});
		const doc = parse(html);

		const slot = doc.querySelector("[data-test-reader-summary]");
		assert(slot, "summary slot must be rendered");
		expect(
			slot.classList.contains("article-body__summary-slot--hidden"),
		).toBe(true);
	});

	it("marks the summary slot as hidden when summary is null", () => {
		const html = renderArticleBody({
			...baseInput,
			content: "<p>Body</p>",
			summary: null,
		});
		const doc = parse(html);

		const slot = doc.querySelector("[data-test-reader-summary]");
		assert(slot, "summary slot must be rendered");
		expect(
			slot.classList.contains("article-body__summary-slot--hidden"),
		).toBe(true);
	});

	it("renders the back link inside the back slot when backLink is provided", () => {
		const html = renderArticleBody({
			...baseInput,
			content: "<p>Body</p>",
			backLink: { href: "/queue", label: "← Back" },
		});
		const doc = parse(html);

		const slot = doc.querySelector("[data-test-back-slot]");
		assert(slot, "back slot must be rendered");
		expect(slot.classList.contains("article-body__back-slot--visible")).toBe(
			true,
		);
		const link = slot.querySelector("[data-test-back-link]");
		assert(link, "back link must be rendered when backLink is provided");
		expect(link.getAttribute("href")).toBe("/queue");
		expect(link.textContent).toBe("← Back");
	});

	it("marks the back slot as hidden when backLink is not provided", () => {
		const html = renderArticleBody({
			...baseInput,
			content: "<p>Body</p>",
		});
		const doc = parse(html);

		const slot = doc.querySelector("[data-test-back-slot]");
		assert(slot, "back slot must be rendered");
		expect(slot.classList.contains("article-body__back-slot--hidden")).toBe(
			true,
		);
	});

	it("marks the audio slot as visible when audioEnabled is true", () => {
		const html = renderArticleBody({
			...baseInput,
			content: "<p>Body</p>",
			audioEnabled: true,
		});
		const doc = parse(html);

		const slot = doc.querySelector("[data-test-audio-player]");
		assert(slot, "audio slot must be rendered");
		expect(slot.classList.contains("article-body__audio-slot--visible")).toBe(
			true,
		);
		const audio = slot.querySelector("[data-audio-element]");
		assert(audio, "audio element must be rendered when audioEnabled");
	});

	it("marks the audio slot as hidden when audioEnabled is absent", () => {
		const html = renderArticleBody({
			...baseInput,
			content: "<p>Body</p>",
		});
		const doc = parse(html);

		const slot = doc.querySelector("[data-test-audio-player]");
		assert(slot, "audio slot must be rendered");
		expect(slot.classList.contains("article-body__audio-slot--hidden")).toBe(
			true,
		);
	});

	it("renders the no-content fallback when content is undefined", () => {
		const html = renderArticleBody({
			...baseInput,
			content: undefined,
		});
		const doc = parse(html);

		const fallback = doc.querySelector("[data-test-no-content]");
		assert(fallback, "no-content fallback must be rendered");
		const originalLink = fallback.querySelector("a");
		expect(originalLink?.getAttribute("href")).toBe("https://example.com/post");
	});
});
