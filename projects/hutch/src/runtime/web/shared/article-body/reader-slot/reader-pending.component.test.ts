import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { renderReaderPending } from "./reader-pending.component";

function parse(html: string) {
	return new JSDOM(`<!doctype html><html><body>${html}</body></html>`).window
		.document;
}

describe("renderReaderPending", () => {
	it("renders polling attributes and the fetching message when pollUrl is provided", () => {
		const doc = parse(
			renderReaderPending({ pollUrl: "/queue/abc/reader?poll=1" }),
		);

		const slot = doc.querySelector("[data-test-reader-slot]");
		assert(slot, "reader slot must be rendered");
		expect(slot.getAttribute("data-reader-status")).toBe("pending");
		expect(slot.getAttribute("hx-get")).toBe("/queue/abc/reader?poll=1");
		expect(slot.getAttribute("hx-trigger")).toBe("every 3s");
		expect(slot.getAttribute("hx-swap")).toBe("outerHTML");
		expect(doc.querySelector(".article-body__reader-loading")?.textContent).toBe(
			"Fetching article",
		);
	});

	it("renders a terminal slot without polling attributes when pollUrl is omitted", () => {
		const doc = parse(renderReaderPending({}));

		const slot = doc.querySelector("[data-test-reader-slot]");
		assert(slot, "reader slot must be rendered");
		expect(slot.hasAttribute("hx-get")).toBe(false);
		expect(
			doc.querySelector(".article-body__reader-loading")?.textContent,
		).toContain("Still fetching");
	});

	it("renders progress data attributes and a fill bar at the supplied percentage", () => {
		const doc = parse(
			renderReaderPending({
				pollUrl: "/queue/abc/reader?poll=1",
				progress: {
					stage: "crawl-parsed",
					pct: 55,
					tickAt: "2026-04-25T12:00:00.000Z",
				},
			}),
		);

		const slot = doc.querySelector("[data-test-reader-slot]");
		assert(slot, "reader slot must be rendered");
		expect(slot.getAttribute("data-progress-stage")).toBe("crawl-parsed");
		expect(slot.getAttribute("data-progress-pct")).toBe("55");
		expect(slot.getAttribute("data-progress-tick-at")).toBe(
			"2026-04-25T12:00:00.000Z",
		);

		const fill = doc.querySelector<HTMLElement>(
			".article-body__reader-progress-fill",
		);
		assert(fill, "progress fill element must be rendered");
		expect(fill.style.width).toBe("55%");
	});

	it("falls back to the first crawl stage when no progress is supplied (SSR before first stage write)", () => {
		const doc = parse(renderReaderPending({ pollUrl: "/q/abc/r?poll=1" }));

		const slot = doc.querySelector("[data-test-reader-slot]");
		assert(slot, "reader slot must be rendered");
		expect(slot.getAttribute("data-progress-stage")).toBe("crawl-fetching");
		expect(slot.getAttribute("data-progress-pct")).toBe("15");
		// Empty tick-at signals the client to skip rate extrapolation until a
		// real tick lands via a poll swap.
		expect(slot.getAttribute("data-progress-tick-at")).toBe("");
	});
});
