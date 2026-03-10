import baseConfig from "../../knip.config.base";
import type { KnipConfig } from "knip";

const { workspaces: _workspaces, ...base } = baseConfig;

export default {
	...base,
	ignore: [
		// CLI script for version management (not an entry point)
		"scripts/bump-version.js",
		// PurgeCSS config loaded via CLI, not imported in source
		"purgecss.config.js",
	],
	ignoreDependencies: [
		// Workspace dependency — knip can't trace through esbuild-bundled entry points
		"browser-extension-core",
	],
	ignoreBinaries: [
		...(base.ignoreBinaries ?? []),
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
