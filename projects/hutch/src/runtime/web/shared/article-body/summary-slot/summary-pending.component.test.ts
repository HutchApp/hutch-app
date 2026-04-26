import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { renderSummaryPending } from "./summary-pending.component";

function parse(html: string) {
	return new JSDOM(`<!doctype html><html><body>${html}</body></html>`).window
		.document;
}

describe("renderSummaryPending", () => {
	it("renders polling attributes and the generating message when pollUrl is provided", () => {
		const doc = parse(
			renderSummaryPending({ pollUrl: "/queue/abc/summary?poll=1" }),
		);

		const slot = doc.querySelector("[data-test-reader-summary]");
		assert(slot, "summary slot must be rendered");
		expect(slot.getAttribute("data-summary-status")).toBe("pending");
		expect(slot.getAttribute("hx-get")).toBe("/queue/abc/summary?poll=1");
		expect(slot.getAttribute("hx-trigger")).toBe("every 3s");
		expect(slot.getAttribute("hx-swap")).toBe("outerHTML");
		expect(doc.querySelector(".article-body__summary-loading")?.textContent).toBe(
			"Generating summary",
		);
	});

	it("renders a terminal slot without polling attributes when pollUrl is omitted", () => {
		const doc = parse(renderSummaryPending({}));

		const slot = doc.querySelector("[data-test-reader-summary]");
		assert(slot, "summary slot must be rendered");
		expect(slot.hasAttribute("hx-get")).toBe(false);
		expect(doc.querySelector(".article-body__summary-loading")?.textContent).toContain(
			"Still generating",
		);
	});

	it("renders progress data attributes and a fill bar at the supplied percentage", () => {
		const doc = parse(
			renderSummaryPending({
				pollUrl: "/queue/abc/summary?poll=1",
				progress: {
					stage: "summary-generating",
					pct: 40,
					tickAt: "2026-04-25T12:00:00.000Z",
				},
			}),
		);

		const slot = doc.querySelector("[data-test-reader-summary]");
		assert(slot, "summary slot must be rendered");
		expect(slot.getAttribute("data-progress-stage")).toBe("summary-generating");
		expect(slot.getAttribute("data-progress-pct")).toBe("40");
		expect(slot.getAttribute("data-progress-tick-at")).toBe(
			"2026-04-25T12:00:00.000Z",
		);

		const fill = doc.querySelector<HTMLElement>(
			".article-body__summary-progress-fill",
		);
		assert(fill, "progress fill element must be rendered");
		expect(fill.style.width).toBe("40%");
	});

	it("falls back to the first summary stage when no progress is supplied", () => {
		const doc = parse(renderSummaryPending({ pollUrl: "/q/abc/s?poll=1" }));

		const slot = doc.querySelector("[data-test-reader-summary]");
		assert(slot, "summary slot must be rendered");
		expect(slot.getAttribute("data-progress-stage")).toBe("summary-started");
		expect(slot.getAttribute("data-progress-pct")).toBe("10");
	});
});
