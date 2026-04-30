import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { renderProgressBar, renderProgressBarOob } from "./progress-bar.component";

function parse(html: string): Document {
	return new JSDOM(`<!doctype html><html><body>${html}</body></html>`).window.document;
}

describe("renderProgressBar", () => {
	it("renders a visible bar with the stage, pct and tickAt as data attributes", () => {
		const doc = parse(
			renderProgressBar({
				progress: {
					stage: "crawl-parsed",
					pct: 25,
					tickAt: "2026-04-25T12:00:00.000Z",
				},
			}),
		);

		const bar = doc.querySelector("[data-test-progress-bar]");
		assert(bar, "bar must be rendered");
		expect(bar.classList.contains("article-body__progress--visible")).toBe(true);
		expect(bar.getAttribute("data-progress-stage")).toBe("crawl-parsed");
		expect(bar.getAttribute("data-progress-pct")).toBe("25");
		expect(bar.getAttribute("data-progress-tick-at")).toBe(
			"2026-04-25T12:00:00.000Z",
		);

		const fill = bar.querySelector<HTMLElement>(".article-body__progress-fill");
		assert(fill, "progress fill must be rendered");
		expect(fill.style.width).toBe("25%");
	});

	it("renders the bar in its hidden state when progress is undefined so HTMX OOB swaps still have a target", () => {
		const doc = parse(renderProgressBar({ progress: undefined }));

		const bar = doc.querySelector("[data-test-progress-bar]");
		assert(bar, "bar element must always be present");
		expect(bar.classList.contains("article-body__progress--hidden")).toBe(true);
	});

	it("uses a stable id so HTMX hx-swap-oob can target the live element across swaps", () => {
		const doc = parse(
			renderProgressBar({
				progress: {
					stage: "summary-generating",
					pct: 90,
					tickAt: "2026-04-25T12:00:00.000Z",
				},
			}),
		);

		expect(doc.querySelector("#article-body-progress")).not.toBeNull();
	});
});

describe("renderProgressBarOob", () => {
	it("emits the same bar wrapped with hx-swap-oob for inclusion in poll responses", () => {
		const html = renderProgressBarOob({
			progress: {
				stage: "summary-content-loaded",
				pct: 75,
				tickAt: "2026-04-25T12:00:00.000Z",
			},
		});
		const doc = parse(html);

		const bar = doc.querySelector("#article-body-progress");
		assert(bar, "OOB bar must be rendered");
		expect(bar.getAttribute("hx-swap-oob")).toBe("outerHTML");
		expect(bar.getAttribute("data-progress-pct")).toBe("75");
	});
});
