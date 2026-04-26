/**
 * Client-side progress-bar animation.
 *
 * Each pending reader/summary slot fragment carries:
 *   data-progress-bar          (on the inner bar wrapper)
 *   data-progress-pct          (latest percentage, integer 0–100)
 *   data-progress-tick-at      (ISO timestamp of the latest server tick)
 *   data-progress-stage        (stage name, opaque to the bar)
 *
 * The server returns a fresh fragment every 3s via HTMX. Between swaps the
 * bar would be static; this module records (tickAt, pct) for each bar and
 * extrapolates linearly so the fill smoothly advances at the observed rate.
 */

export interface BarTick {
	tickAtMs: number;
	pct: number;
}

/**
 * Inline assertion. We can't `import assert from "node:assert"` because esbuild
 * bundles this module for the browser and `node:assert` is not resolvable in a
 * browser target.
 */
function assert(cond: unknown, message: string): asserts cond {
	if (!cond) throw new Error(message);
}

/**
 * Linear rate between two ticks, floored at 0 so a regression (worker
 * redelivery) doesn't pull the bar backwards mid-frame.
 */
export function computeRate(prev: BarTick, next: BarTick): number {
	const dt = next.tickAtMs - prev.tickAtMs;
	if (dt <= 0) return 0;
	const rate = (next.pct - prev.pct) / dt;
	return rate > 0 ? rate : 0;
}

/**
 * Project a percentage forward from the last observed tick, capped so we
 * never crowd 100% before the server confirms `crawl-ready` or
 * `summary-complete`.
 */
export function projectPct(args: {
	lastPct: number;
	rate: number;
	elapsedMs: number;
	cap: number;
}): number {
	const projected = args.lastPct + args.rate * args.elapsedMs;
	if (projected > args.cap) return args.cap;
	if (projected < args.lastPct) return args.lastPct;
	return projected;
}

export interface ProgressBarAttrs {
	pct: number;
	tickAtMs: number | undefined;
}

/**
 * Read the data-progress-* attributes off a slot element. Returns
 * `tickAtMs: undefined` when the SSR fallback used an empty tickAt — in
 * that case the client should not extrapolate, only render the static SSR
 * pct until the first poll lands a real timestamp.
 */
export function readProgressAttrs(slot: Element): ProgressBarAttrs | undefined {
	const pctRaw = slot.getAttribute("data-progress-pct");
	if (pctRaw === null) return undefined;
	const pct = Number.parseFloat(pctRaw);
	if (!Number.isFinite(pct)) return undefined;
	const tickAtRaw = slot.getAttribute("data-progress-tick-at");
	if (tickAtRaw === null || tickAtRaw === "") {
		return { pct, tickAtMs: undefined };
	}
	const tickAtMs = Date.parse(tickAtRaw);
	if (!Number.isFinite(tickAtMs)) return { pct, tickAtMs: undefined };
	return { pct, tickAtMs };
}

/**
 * Narrow shape of the progress-fill element. Avoids referring to the global
 * `HTMLElement` constructor — the unit test runs under Jest's Node env where
 * `HTMLElement` is not a global, while a JSDOM `HTMLElement` is per-window.
 */
interface BarFill {
	style: { width: string };
}

interface BarState {
	prev: BarTick | undefined;
	last: BarTick;
	rate: number;
	fill: BarFill;
}

interface ProgressBarDeps {
	document: Document;
	now: () => number;
	requestAnimationFrame: (cb: () => void) => number;
	cancelAnimationFrame: (id: number) => void;
	addSwapListener: (listener: () => void) => void;
}

interface ProgressBarController {
	/** Re-scan the DOM for progress bars and merge new ticks into the state map. */
	scan(): void;
	/** Stop the rAF loop. */
	stop(): void;
}

const PROGRESS_CAP = 99;

export function initProgressBars(deps: ProgressBarDeps): ProgressBarController {
	const states = new WeakMap<Element, BarState>();
	const tracked: Element[] = [];
	let rafId: number | undefined;
	let stopped = false;

	function findBars(): Element[] {
		return Array.from(deps.document.querySelectorAll("[data-progress-bar]"));
	}

	function syncBar(bar: Element): void {
		const slot = bar.parentElement;
		assert(slot, "progress-bar element must be inside a slot wrapper");
		const attrs = readProgressAttrs(slot);
		assert(attrs, "slot must carry data-progress-pct (template invariant)");
		const fill: BarFill | null = bar.querySelector<HTMLElement>(
			":scope > [class$='-progress-fill']",
		);
		assert(fill, "slot must contain a *-progress-fill element (template invariant)");

		const existing = states.get(bar);
		const incomingTickMs = attrs.tickAtMs;

		if (existing === undefined) {
			// First time seeing this bar. Anchor at the SSR-supplied pct. If the
			// server didn't emit a real timestamp (empty SSR fallback), anchor
			// against deps.now() so a later real tick still produces a positive
			// elapsed window for computeRate.
			const anchorTickAtMs = incomingTickMs ?? deps.now();
			states.set(bar, {
				prev: undefined,
				last: { pct: attrs.pct, tickAtMs: anchorTickAtMs },
				rate: 0,
				fill,
			});
			tracked.push(bar);
			return;
		}

		// Re-scan saw no real server tick (still on SSR fallback) — leave the
		// existing anchor in place so projection keeps using the same basis.
		if (incomingTickMs === undefined) return;

		// Same server tick we already absorbed (re-scan without a real swap).
		if (incomingTickMs === existing.last.tickAtMs) return;

		const newTick: BarTick = { pct: attrs.pct, tickAtMs: incomingTickMs };
		states.set(bar, {
			prev: existing.last,
			last: newTick,
			rate: computeRate(existing.last, newTick),
			fill,
		});
	}

	function tick(): void {
		if (stopped) return;
		const now = deps.now();
		// Iterate a stable snapshot — DOM mutations can splice the live list.
		for (let i = tracked.length - 1; i >= 0; i -= 1) {
			const bar = tracked[i];
			if (!bar.isConnected) {
				tracked.splice(i, 1);
				continue;
			}
			const state = states.get(bar);
			assert(state, "tracked bar must have a state entry");
			const elapsed = now - state.last.tickAtMs;
			const projected = projectPct({
				lastPct: state.last.pct,
				rate: state.rate,
				elapsedMs: elapsed,
				cap: PROGRESS_CAP,
			});
			state.fill.style.width = `${projected}%`;
		}
		rafId = deps.requestAnimationFrame(tick);
	}

	function scan(): void {
		const bars = findBars();
		for (const bar of bars) syncBar(bar);
	}

	deps.addSwapListener(scan);
	scan();
	rafId = deps.requestAnimationFrame(tick);

	return {
		scan,
		stop(): void {
			stopped = true;
			if (rafId !== undefined) deps.cancelAnimationFrame(rafId);
		},
	};
}
