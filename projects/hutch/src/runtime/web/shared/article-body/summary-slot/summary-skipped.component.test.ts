import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { renderSummarySkipped } from "./summary-skipped.component";

function parse(html: string) {
	return new JSDOM(`<!doctype html><html><body>${html}</body></html>`).window
		.document;
}

describe("renderSummarySkipped", () => {
	it("renders a hidden slot with status=skipped and no inner content", () => {
		const doc = parse(renderSummarySkipped());

		const slot = doc.querySelector("[data-test-reader-summary]");
		assert(slot, "summary slot must be rendered");
		expect(slot.getAttribute("data-summary-status")).toBe("skipped");
		expect(slot.classList.contains("article-body__summary-slot--hidden")).toBe(
			true,
		);
		expect(slot.children.length).toBe(0);
	});
});
