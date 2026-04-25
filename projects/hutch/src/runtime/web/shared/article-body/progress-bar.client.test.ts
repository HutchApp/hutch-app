import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
	computeRate,
	initProgressBars,
	projectPct,
	readProgressAttrs,
} from "./progress-bar.client";

describe("progress-bar.client", () => {
	describe("computeRate", () => {
		it("returns the linear pct/ms rate between two ticks", () => {
			expect(
				computeRate(
					{ tickAtMs: 1000, pct: 15 },
					{ tickAtMs: 4000, pct: 35 },
				),
			).toBeCloseTo(20 / 3000);
		});

		it("returns 0 when ticks are simultaneous (no elapsed time)", () => {
			expect(
				computeRate(
					{ tickAtMs: 1000, pct: 15 },
					{ tickAtMs: 1000, pct: 35 },
				),
			).toBe(0);
		});

		it("returns 0 when ticks regress (server replayed an earlier stage)", () => {
			expect(
				computeRate(
					{ tickAtMs: 1000, pct: 35 },
					{ tickAtMs: 4000, pct: 15 },
				),
			).toBe(0);
		});

		it("returns 0 when timestamps run backwards (clock skew or replay)", () => {
			expect(
				computeRate(
					{ tickAtMs: 4000, pct: 15 },
					{ tickAtMs: 1000, pct: 35 },
				),
			).toBe(0);
		});
	});

	describe("projectPct", () => {
		it("advances pct by rate * elapsed", () => {
			expect(
				projectPct({ lastPct: 35, rate: 20 / 3000, elapsedMs: 1500, cap: 99 }),
			).toBeCloseTo(45);
		});

		it("caps at the supplied cap so the bar never appears complete prematurely", () => {
			expect(
				projectPct({ lastPct: 90, rate: 0.05, elapsedMs: 10000, cap: 99 }),
			).toBe(99);
		});

		it("never regresses below lastPct (defensive against negative rate inputs)", () => {
			expect(
				projectPct({ lastPct: 50, rate: -1, elapsedMs: 1000, cap: 99 }),
			).toBe(50);
		});
	});

	describe("readProgressAttrs", () => {
		function slotWith(attrs: Record<string, string | undefined>): Element {
			const dom = new JSDOM(`<!doctype html><html><body><div></div></body></html>`);
			const slot = dom.window.document.querySelector("div");
			assert(slot, "test fixture slot must be rendered");
			for (const [k, v] of Object.entries(attrs)) {
				if (v !== undefined) slot.setAttribute(k, v);
			}
			return slot;
		}

		it("returns pct and parsed tickAtMs when both attrs are valid", () => {
			const result = readProgressAttrs(
				slotWith({
					"data-progress-pct": "55",
					"data-progress-tick-at": "2026-04-25T12:00:00.000Z",
				}),
			);
			expect(result).toEqual({
				pct: 55,
				tickAtMs: Date.parse("2026-04-25T12:00:00.000Z"),
			});
		});

		it("returns tickAtMs: undefined when tickAt is the empty SSR fallback", () => {
			const result = readProgressAttrs(
				slotWith({
					"data-progress-pct": "15",
					"data-progress-tick-at": "",
				}),
			);
			expect(result).toEqual({ pct: 15, tickAtMs: undefined });
		});

		it("returns tickAtMs: undefined when tickAt is unparseable", () => {
			const result = readProgressAttrs(
				slotWith({
					"data-progress-pct": "15",
					"data-progress-tick-at": "not-a-date",
				}),
			);
			expect(result).toEqual({ pct: 15, tickAtMs: undefined });
		});

		it("returns undefined when data-progress-pct is missing", () => {
			expect(readProgressAttrs(slotWith({}))).toBeUndefined();
		});

		it("returns undefined when pct is non-numeric", () => {
			expect(
				readProgressAttrs(slotWith({ "data-progress-pct": "not-a-number" })),
			).toBeUndefined();
		});
	});

	describe("initProgressBars", () => {
		function setupDom(html: string) {
			const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`);
			return dom.window.document;
		}

		function createSlot(opts: {
			pct: number;
			tickAt: string;
			fillClass: string;
			variant: "reader" | "summary";
		}) {
			return `
				<div data-progress-pct="${opts.pct}" data-progress-tick-at="${opts.tickAt}" data-progress-stage="x">
					<div class="article-body__${opts.variant}-progress" data-progress-bar>
						<div class="${opts.fillClass}"></div>
					</div>
				</div>
			`;
		}

		it("on first scan stores the pct as the initial tick and writes the inline fill width", () => {
			const document = setupDom(
				createSlot({
					pct: 15,
					tickAt: "2026-04-25T12:00:00.000Z",
					fillClass: "article-body__reader-progress-fill",
					variant: "reader",
				}),
			);
			let scheduled: (() => void) | undefined;
			const swapListeners: Array<() => void> = [];
			initProgressBars({
				document,
				now: () => Date.parse("2026-04-25T12:00:00.000Z"),
				requestAnimationFrame: (cb) => {
					scheduled = cb;
					return 1;
				},
				cancelAnimationFrame: () => {},
				addSwapListener: (l) => swapListeners.push(l),
			});

			assert(scheduled, "rAF callback must be scheduled at least once");
			scheduled();

			const fill = document.querySelector<HTMLElement>(
				".article-body__reader-progress-fill",
			);
			assert(fill, "fill rendered");
			expect(fill.style.width).toBe("15%");
		});

		it("after a second swap with a later tick extrapolates pct between ticks", () => {
			const document = setupDom(
				createSlot({
					pct: 15,
					tickAt: "2026-04-25T12:00:00.000Z",
					fillClass: "article-body__reader-progress-fill",
					variant: "reader",
				}),
			);
			let scheduled: (() => void) | undefined;
			let nowMs = Date.parse("2026-04-25T12:00:00.000Z");
			const swapListeners: Array<() => void> = [];
			const controller = initProgressBars({
				document,
				now: () => nowMs,
				requestAnimationFrame: (cb) => {
					scheduled = cb;
					return 1;
				},
				cancelAnimationFrame: () => {},
				addSwapListener: (l) => swapListeners.push(l),
			});

			// Server emits the second tick 3s later at 35%.
			const slot = document.querySelector("[data-progress-pct]");
			assert(slot, "slot present");
			slot.setAttribute("data-progress-pct", "35");
			slot.setAttribute(
				"data-progress-tick-at",
				"2026-04-25T12:00:03.000Z",
			);
			controller.scan();

			// 1.5s after the second tick — halfway between 35 and the projection.
			nowMs = Date.parse("2026-04-25T12:00:04.500Z");
			assert(scheduled);
			scheduled();

			const fill = document.querySelector<HTMLElement>(
				".article-body__reader-progress-fill",
			);
			assert(fill, "fill rendered");
			// rate = (35-15)/3000 = 0.00666… per ms; at 1500ms => +10 → ~45%
			expect(Number.parseFloat(fill.style.width)).toBeCloseTo(45, 0);
		});

		it("re-scans on swap notification and tracks newly-mounted bars", () => {
			const document = setupDom("");
			const swapListeners: Array<() => void> = [];
			let scheduled: (() => void) | undefined;
			initProgressBars({
				document,
				now: () => 0,
				requestAnimationFrame: (cb) => {
					scheduled = cb;
					return 1;
				},
				cancelAnimationFrame: () => {},
				addSwapListener: (l) => swapListeners.push(l),
			});

			document.body.innerHTML = createSlot({
				pct: 25,
				tickAt: "2026-04-25T12:00:00.000Z",
				fillClass: "article-body__summary-progress-fill",
				variant: "summary",
			});

			for (const l of swapListeners) l();
			assert(scheduled);
			scheduled();

			const fill = document.querySelector<HTMLElement>(
				".article-body__summary-progress-fill",
			);
			assert(fill);
			expect(fill.style.width).toBe("25%");
		});

		it("anchors against deps.now() when the SSR fallback emits an empty tickAt", () => {
			const document = setupDom(
				createSlot({
					pct: 15,
					tickAt: "",
					fillClass: "article-body__reader-progress-fill",
					variant: "reader",
				}),
			);
			let scheduled: (() => void) | undefined;
			const NOW = 1_700_000_000_000;
			initProgressBars({
				document,
				now: () => NOW,
				requestAnimationFrame: (cb) => {
					scheduled = cb;
					return 1;
				},
				cancelAnimationFrame: () => {},
				addSwapListener: () => {},
			});

			assert(scheduled);
			scheduled();

			const fill = document.querySelector<HTMLElement>(
				".article-body__reader-progress-fill",
			);
			assert(fill);
			expect(fill.style.width).toBe("15%");
		});

		it("ignores re-scan with empty tickAt after a real tick (no anchor regression)", () => {
			const document = setupDom(
				createSlot({
					pct: 15,
					tickAt: "2026-04-25T12:00:00.000Z",
					fillClass: "article-body__reader-progress-fill",
					variant: "reader",
				}),
			);
			const swapListeners: Array<() => void> = [];
			let scheduled: (() => void) | undefined;
			let nowMs = Date.parse("2026-04-25T12:00:00.000Z");
			const controller = initProgressBars({
				document,
				now: () => nowMs,
				requestAnimationFrame: (cb) => {
					scheduled = cb;
					return 1;
				},
				cancelAnimationFrame: () => {},
				addSwapListener: (l) => swapListeners.push(l),
			});

			// A re-scan with empty tickAt (e.g., a redrive that lost the timestamp)
			// should not reset the anchor.
			const slot = document.querySelector("[data-progress-pct]");
			assert(slot);
			slot.setAttribute("data-progress-tick-at", "");
			controller.scan();

			// 1500ms later — projection still based on the original anchor (pct=15,
			// rate=0 since only one tick has been observed).
			nowMs = Date.parse("2026-04-25T12:00:01.500Z");
			assert(scheduled);
			scheduled();
			const fill = document.querySelector<HTMLElement>(
				".article-body__reader-progress-fill",
			);
			assert(fill);
			expect(fill.style.width).toBe("15%");
		});

		it("ignores a re-scan that carries the same tickAt (no DOM swap occurred)", () => {
			const document = setupDom(
				createSlot({
					pct: 15,
					tickAt: "2026-04-25T12:00:00.000Z",
					fillClass: "article-body__reader-progress-fill",
					variant: "reader",
				}),
			);
			let scheduled: (() => void) | undefined;
			const controller = initProgressBars({
				document,
				now: () => Date.parse("2026-04-25T12:00:00.000Z"),
				requestAnimationFrame: (cb) => {
					scheduled = cb;
					return 1;
				},
				cancelAnimationFrame: () => {},
				addSwapListener: () => {},
			});

			// Re-scan without changing tickAt — must be a no-op.
			controller.scan();
			assert(scheduled);
			scheduled();

			const fill = document.querySelector<HTMLElement>(
				".article-body__reader-progress-fill",
			);
			assert(fill);
			expect(fill.style.width).toBe("15%");
		});

		it("drops bars from the tracked list once they are disconnected from the DOM", () => {
			const document = setupDom(
				createSlot({
					pct: 25,
					tickAt: "2026-04-25T12:00:00.000Z",
					fillClass: "article-body__reader-progress-fill",
					variant: "reader",
				}),
			);
			let scheduled: (() => void) | undefined;
			initProgressBars({
				document,
				now: () => 0,
				requestAnimationFrame: (cb) => {
					scheduled = cb;
					return 1;
				},
				cancelAnimationFrame: () => {},
				addSwapListener: () => {},
			});

			// Disconnect — simulates the slot swapping to reader-ready.
			document.body.innerHTML = "";

			// Loop must not throw and must accept the disconnected element.
			assert(scheduled);
			const cb = scheduled;
			expect(() => cb()).not.toThrow();
		});

		it("throws when a progress-bar element is missing the data-progress-pct attribute (template invariant)", () => {
			const document = setupDom(
				`<div><div data-progress-bar><div class="article-body__reader-progress-fill"></div></div></div>`,
			);
			expect(() =>
				initProgressBars({
					document,
					now: () => 0,
					requestAnimationFrame: () => 1,
					cancelAnimationFrame: () => {},
					addSwapListener: () => {},
				}),
			).toThrow(/data-progress-pct/);
		});

		it("throws when a progress-bar element is missing its fill child (template invariant)", () => {
			const document = setupDom(
				`<div data-progress-pct="15" data-progress-tick-at=""><div data-progress-bar></div></div>`,
			);
			expect(() =>
				initProgressBars({
					document,
					now: () => 0,
					requestAnimationFrame: () => 1,
					cancelAnimationFrame: () => {},
					addSwapListener: () => {},
				}),
			).toThrow(/progress-fill/);
		});

		it("stops the rAF loop when stop() is called", () => {
			const document = setupDom("");
			let cancelled = 0;
			const controller = initProgressBars({
				document,
				now: () => 0,
				requestAnimationFrame: () => 42,
				cancelAnimationFrame: (id) => {
					if (id === 42) cancelled += 1;
				},
				addSwapListener: () => {},
			});
			controller.stop();
			expect(cancelled).toBe(1);
		});
	});
});
