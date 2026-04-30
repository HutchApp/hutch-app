import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "../../render";
import type { ProgressTick } from "./progress-mapping";

const TEMPLATE = readFileSync(join(__dirname, "progress-bar.template.html"), "utf-8");

export interface ProgressBarInput {
	progress: ProgressTick | undefined;
}

/**
 * Renders the unified progress bar. The element is always emitted so HTMX OOB
 * swaps targeting `#article-body-progress` always have something to replace,
 * and so the per-state class — not display:none on a missing element — drives
 * visibility. When `progress` is undefined the bar collapses to its hidden
 * state (post-crawl-ready+summary-complete or post-crawl-failed).
 */
export function renderProgressBar(input: ProgressBarInput): string {
	if (input.progress === undefined) {
		return render(TEMPLATE, {
			visibilityClass: "article-body__progress--hidden",
			stage: "",
			pct: 0,
			tickAt: "",
		});
	}
	return render(TEMPLATE, {
		visibilityClass: "article-body__progress--visible",
		stage: input.progress.stage,
		pct: input.progress.pct,
		tickAt: input.progress.tickAt,
	});
}

/**
 * The same bar wrapped in an `hx-swap-oob` envelope for inclusion in slot
 * poll responses. HTMX pulls the element out of the response body, replaces
 * the live `#article-body-progress` element on the page, and discards the
 * envelope before swapping the primary fragment into the slot.
 */
export function renderProgressBarOob(input: ProgressBarInput): string {
	const inner = renderProgressBar(input);
	// `hx-swap-oob` is recognised on the swapped element itself. The htmx docs
	// document attaching the attribute to the element with the matching id
	// (rather than wrapping in a template), which keeps the envelope free of an
	// extra DOM node we'd then need to strip in tests.
	return inner.replace(
		"<div id=\"article-body-progress\"",
		"<div id=\"article-body-progress\" hx-swap-oob=\"outerHTML\"",
	);
}
