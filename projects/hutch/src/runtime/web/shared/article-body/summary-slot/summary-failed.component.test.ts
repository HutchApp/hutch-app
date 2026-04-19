import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { renderSummaryFailed } from "./summary-failed.component";

function parse(html: string) {
	return new JSDOM(`<!doctype html><html><body>${html}</body></html>`).window
		.document;
}

describe("renderSummaryFailed", () => {
	it("renders a visible slot with status=failed and the error copy", () => {
		const doc = parse(renderSummaryFailed());

		const slot = doc.querySelector("[data-test-reader-summary]");
		assert(slot, "summary slot must be rendered");
		expect(slot.getAttribute("data-summary-status")).toBe("failed");
		expect(slot.classList.contains("article-body__summary-slot--visible")).toBe(
			true,
		);
		expect(
			doc.querySelector(".article-body__summary-error")?.textContent,
		).toContain("couldn't generate a summary");
	});
});
