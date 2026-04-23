import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { renderReaderFailed } from "./reader-failed.component";

function parse(html: string) {
	return new JSDOM(`<!doctype html><html><body>${html}</body></html>`).window
		.document;
}

describe("renderReaderFailed", () => {
	it("renders the failure copy and a link back to the original article", () => {
		const doc = parse(renderReaderFailed({ url: "https://example.com/post" }));

		const slot = doc.querySelector("[data-test-reader-slot]");
		assert(slot, "reader slot must be rendered");
		expect(slot.getAttribute("data-reader-status")).toBe("failed");
		expect(
			doc.querySelector(".article-body__reader-failed-title")?.textContent,
		).toBe("We couldn't fetch this article");
		const link = doc.querySelector(".article-body__reader-failed-link");
		expect(link?.getAttribute("href")).toBe("https://example.com/post");
		expect(link?.getAttribute("rel")).toBe("noopener");
	});
});
