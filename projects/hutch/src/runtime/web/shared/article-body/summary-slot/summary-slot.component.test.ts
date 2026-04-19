import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { renderSummarySlot } from "./summary-slot.component";

function parse(html: string) {
	return new JSDOM(`<!doctype html><html><body>${html}</body></html>`).window
		.document;
}

describe("renderSummarySlot", () => {
	it("returns only the slot HTML (no outer page)", () => {
		const html = renderSummarySlot({
			summary: { status: "ready", summary: "Point." },
			summaryOpen: false,
		});

		expect(html.startsWith("<div")).toBe(true);
		expect(html.includes("<html")).toBe(false);
	});

	it("routes status=ready to the ready component", () => {
		const doc = parse(
			renderSummarySlot({
				summary: { status: "ready", summary: "Key points." },
				summaryOpen: true,
			}),
		);

		const slot = doc.querySelector("[data-test-reader-summary]");
		assert(slot, "summary slot must be rendered");
		expect(slot.getAttribute("data-summary-status")).toBe("ready");
		const details = doc.querySelector(".article-body__summary");
		assert(details, "summary details element must be rendered");
		expect(details.hasAttribute("open")).toBe(true);
	});

	it("routes status=pending to the pending component with the poll URL", () => {
		const doc = parse(
			renderSummarySlot({
				summary: { status: "pending" },
				summaryPollUrl: "/queue/abc/summary?poll=1",
			}),
		);

		const slot = doc.querySelector("[data-test-reader-summary]");
		assert(slot, "summary slot must be rendered");
		expect(slot.getAttribute("data-summary-status")).toBe("pending");
		expect(slot.getAttribute("hx-get")).toBe("/queue/abc/summary?poll=1");
	});

	it("routes status=failed to the failed component", () => {
		const doc = parse(
			renderSummarySlot({
				summary: { status: "failed", reason: "deepseek timeout" },
			}),
		);

		const slot = doc.querySelector("[data-test-reader-summary]");
		assert(slot, "summary slot must be rendered");
		expect(slot.getAttribute("data-summary-status")).toBe("failed");
	});

	it("routes status=skipped to the skipped component", () => {
		const doc = parse(
			renderSummarySlot({ summary: { status: "skipped" } }),
		);

		const slot = doc.querySelector("[data-test-reader-summary]");
		assert(slot, "summary slot must be rendered");
		expect(slot.getAttribute("data-summary-status")).toBe("skipped");
	});

	it("defaults to pending when summary is undefined", () => {
		const doc = parse(renderSummarySlot({ summary: undefined }));

		const slot = doc.querySelector("[data-test-reader-summary]");
		assert(slot, "summary slot must be rendered");
		expect(slot.getAttribute("data-summary-status")).toBe("pending");
	});
});
