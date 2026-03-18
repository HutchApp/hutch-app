import baseConfig from "../../knip.config.base";
import type { KnipConfig } from "knip";

export default {
	...baseConfig,
	ignore: [
		// CLI scripts (not entry points)
		"scripts/bump-version.js",
		"scripts/sync-signed-extension.js",
		// PurgeCSS config loaded via CLI, not imported in source
		"purgecss.config.js",
	],
	ignoreDependencies: [
		// Workspace dependencies — knip can't trace through esbuild-bundled entry points
		"browser-extension-core",
		"@packages/hutch-logger",
		// Dynamic import in E2E test — knip can't trace dynamic imports
		"@packages/hutch-test-app",
	],
	ignoreBinaries: [
		...(baseConfig.ignoreBinaries ?? []),
		// Used via check-infra script
		"pulumi",
	],
	entry: [
		// Extension entry points compiled by esbuild (scripts/build-extension.js)
		"src/runtime/background/background.ts",
		"src/runtime/popup/popup.ts",
		"src/runtime/content/shortcut.ts",
		// E2E test entry points (run via node --test)
		"src/e2e/**/run.e2e-local.ts",
	],
} satisfies KnipConfig;
