/**
 * Bundle browser-side `*.client.ts` modules into same-origin IIFE scripts.
 *
 * Why same-origin instead of STATIC_BASE_URL: the JS bundle changes per commit
 * and must ship with the server that renders the HTML. Routing through the CDN
 * meant any developer who pointed STATIC_BASE_URL at staging got a stale/404
 * response from CloudFront for the latest bundle.
 *
 * Output goes under `src/runtime/web/client-dist/` so the Lambda `copyAssetFiles`
 * step (everything in src/runtime that isn't .ts) ships it alongside the
 * handler, and `copy-static-assets.js` mirrors it into dist/ for test runs.
 */
const esbuild = require("esbuild");
const path = require("node:path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(PROJECT_ROOT, "src", "runtime", "web", "client-dist");

/**
 * 1. `globalName` exposes the module exports on `window.ShareBalloon` inside the IIFE.
 * 2. `footer.js` runs *after* the IIFE body, calling the exported factory with
 *    the real browser globals. The wiring stays out of the source TS so the
 *    `share-balloon.client.ts` module remains pure and unit-testable.
 * 3. `keepNames: false` — the only reason esbuild's `__name` helper caused the
 *    original bug was an inline `.toString()`; inside a self-contained IIFE the
 *    helper is harmless, but we don't need name preservation for runtime logic.
 */
const BUNDLES = [
	{
		entry: path.join(
			PROJECT_ROOT,
			"src/runtime/web/shared/share-balloon/share-balloon.client.ts",
		),
		outfile: path.join(OUT_DIR, "share-balloon.client.js"),
		globalName: "ShareBalloon",
		footer: [
			"ShareBalloon.initShareBalloon({",
			"  window: window,",
			"  document: window.document,",
			"  storage: window.localStorage,",
			"  navigator: window.navigator,",
			"  setTimeoutFn: function (cb, ms) { return window.setTimeout(cb, ms); },",
			"  clearTimeoutFn: function (id) { window.clearTimeout(id); }",
			"}).attach();",
		].join("\n"),
	},
];

function buildOptions(bundle) {
	return {
		entryPoints: [bundle.entry],
		outfile: bundle.outfile,
		bundle: true,
		format: "iife",
		globalName: bundle.globalName,
		footer: { js: bundle.footer },
		target: ["es2020"],
		platform: "browser",
		keepNames: false,
		minify: false,
		sourcemap: true,
		logLevel: "info",
	};
}

async function main() {
	const watch = process.argv.includes("--watch");

	if (watch) {
		const contexts = await Promise.all(
			BUNDLES.map((b) => esbuild.context(buildOptions(b))),
		);
		await Promise.all(contexts.map((ctx) => ctx.watch()));
		console.log("build-client-bundles: watching for changes...");
		return;
	}

	await Promise.all(BUNDLES.map((b) => esbuild.build(buildOptions(b))));
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
