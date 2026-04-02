import baseConfig from "../../../knip.config.base";
import type { KnipConfig } from "knip";

const { workspaces: _workspaces, ...base } = baseConfig;

export default {
	...base,
	ignore: [
		...(base.ignore ?? []),
		// CLI scripts (not entry points)
		"scripts/bump-version.js",
		"scripts/install-chrome-for-testing.js",
		"scripts/submit-to-chrome-web-store.js",
		// PurgeCSS config loaded via CLI, not imported in source
		"purgecss.config.js",
	],
	ignoreDependencies: [
		...(base.ignoreDependencies ?? []),
		// Used via c8 CLI wrapper in test-with-coverage script
		"c8",
		// Used by Pulumi infra (compiled separately)
		"@pulumi/aws",
		"@pulumi/pulumi",
		// Workspace dependencies — knip can't trace through esbuild-bundled entry points
		"browser-extension-core",
		"@packages/hutch-logger",
		// Dynamic import in E2E test — knip can't trace dynamic imports
		"hutch",
		// Used by scripts/check-unused-css.js (not a source-level import)
		"@packages/check-unused-css",
		// Used via scripts/run-tests-with-coverage.js (not a source import)
		"@packages/test-phase-runner",
		// Bundled by esbuild into browser extension entry points
		"webextension-polyfill",
	],
	ignoreBinaries: [
		...(base.ignoreBinaries ?? []),
		// Used via check script to delegate to Nx
		"nx",
		// Used via check-infra script
		"pulumi",
	],
	entry: [
		// Extension entry points compiled by esbuild (scripts/build-extension.js)
		"src/runtime/background/background.ts",
		"src/runtime/popup/popup.ts",
		"src/runtime/content/shortcut.ts",
		"src/runtime/offscreen/offscreen.ts",
		// E2E test entry points (run via node --test)
		"src/e2e/**/run.e2e-local.ts",
	],
} satisfies KnipConfig;
