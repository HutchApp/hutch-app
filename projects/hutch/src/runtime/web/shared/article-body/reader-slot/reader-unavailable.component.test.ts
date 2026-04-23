import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { renderReaderUnavailable } from "./reader-unavailable.component";

function parse(html: string) {
	return new JSDOM(`<!doctype html><html><body>${html}</body></html>`).window
		.document;
}

describe("renderReaderUnavailable", () => {
	it("renders the legacy no-content fallback with a link back to the original", () => {
		const doc = parse(
			renderReaderUnavailable({ url: "https://example.com/post" }),
		);

		const slot = doc.querySelector("[data-test-reader-slot]");
		assert(slot, "reader slot must be rendered");
		expect(slot.getAttribute("data-reader-status")).toBe("unavailable");
		const fallback = doc.querySelector("[data-test-no-content]");
		assert(fallback, "no-content fallback must be rendered");
		expect(fallback.querySelector("h2")?.textContent).toBe(
			"Reader View not yet available",
		);
		expect(fallback.querySelector("a")?.getAttribute("href")).toBe(
			"https://example.com/post",
		);
	});
});
